import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_RE = /^[a-zA-Z0-9]{6,}$/;

const usernameSchema = z
  .string()
  .min(3, "Usuário precisa ter 3–20 caracteres")
  .max(20, "Usuário precisa ter 3–20 caracteres")
  .regex(USERNAME_RE, "Usuário: letras, números ou _");

const passwordSchema = z
  .string()
  .min(6, "Senha precisa ter pelo menos 6 caracteres")
  .regex(PASSWORD_RE, "Senha deve conter apenas letras e números");

const RegisterSchema = z.object({
  email: z.string().email(),
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().optional(),
});

const LoginSchema = z
  .object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    password: passwordSchema,
  })
  .refine((d) => !!(d.identifier?.trim() || d.email?.trim()), {
    message: "Informe email ou usuário",
  });

const ForgotSchema = z
  .object({
    identifier: z.string().optional(),
    email: z.string().optional(),
  })
  .refine((d) => !!(d.identifier?.trim() || d.email?.trim()), {
    message: "Informe email ou usuário",
  });

const ResetSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
  });

function resolveIdentifier(body) {
  return (body.identifier || body.email || "").trim();
}

function isEmail(value) {
  return value.includes("@");
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, email: user.email, username: user.username, name: user.name };
}

async function findUserByIdentifier(raw) {
  const value = raw.trim();
  if (!value) return null;

  if (isEmail(value)) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(value) } });
  }

  const username = normalizeUsername(value);
  return prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: normalizeEmail(value) }],
    },
  });
}

async function sendResetEmail(user, token) {
  const frontendUrl = (process.env.FRONTEND_URL || "https://figurinhass.app").replace(/\/$/, "");
  const resetUrl = `${frontendUrl}/reset-senha.html?token=${token}`;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM || "Figurinhass <no-reply@figurinhass.app>";

  if (!apiKey) {
    console.log(`[password-reset] user=${user.email} url=${resetUrl}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: user.email,
      subject: "Recuperação de senha — Figurinhass",
      html: `
        <p>Olá${user.name ? ` ${user.name}` : ""},</p>
        <p>Recebemos um pedido para redefinir sua senha.</p>
        <p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p>
        <p>O link expira em 1 hora. Se não foi você, ignore este email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[password-reset] falha ao enviar email:", err);
    console.log(`[password-reset] fallback url=${resetUrl}`);
  }
}

router.post("/register", async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const email = normalizeEmail(data.email);
    const username = normalizeUsername(data.username);

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (exists) {
      if (exists.email === email) return res.status(409).json({ error: "Email já cadastrado" });
      return res.status(409).json({ error: "Nome de usuário já em uso" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: data.name,
        passwordHash: await hashPassword(data.password),
      },
    });
    const token = signToken({ uid: user.id });
    setAuthCookie(res, token);
    res.json({ user: publicUser(user), token });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const identifier = resolveIdentifier(data);
    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: "Email ou senha inválidos" });
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Email ou senha inválidos" });
    const token = signToken({ uid: user.id });
    setAuthCookie(res, token);
    res.json({ user: publicUser(user), token });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.post("/forgot", async (req, res, next) => {
  try {
    const data = ForgotSchema.parse(req.body);
    const identifier = resolveIdentifier(data);
    const user = await findUserByIdentifier(identifier);

    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordReset.create({
        data: { userId: user.id, token, expiresAt },
      });

      await sendResetEmail(user, token);
    }

    res.json({
      ok: true,
      message: "Se existir uma conta com esses dados, enviamos um link de recuperação.",
    });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.post("/reset", async (req, res, next) => {
  try {
    const data = ResetSchema.parse(req.body);
    const reset = await prisma.passwordReset.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: "Link inválido ou expirado" });
    }

    const passwordHash = await hashPassword(data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ ok: true, message: "Senha alterada com sucesso" });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
