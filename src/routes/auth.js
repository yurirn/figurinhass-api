import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Senha precisa ter pelo menos 6 caracteres"),
  name: z.string().optional(),
});
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return res.status(409).json({ error: "Email já cadastrado" });
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: await hashPassword(data.password),
      },
    });
    const token = signToken({ uid: user.id });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(401).json({ error: "Email ou senha inválidos" });
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Email ou senha inválidos" });
    const token = signToken({ uid: user.id });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
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
