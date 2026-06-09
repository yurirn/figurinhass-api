import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOwnedAlbum } from "../middleware/requireAuth.js";
import { copa2026Template } from "../seed/template-copa-2026.js";

const router = Router();
router.use(requireAuth);

// GET /albums - lista todos os álbuns do usuário com resumo
router.get("/", async (req, res, next) => {
  try {
    const albums = await prisma.album.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        sections: { select: { count: true, progress: { select: { owned: true } } } },
        groups: {
          include: {
            teams: { select: { count: true, progress: { select: { owned: true } } } },
          },
        },
      },
    });
    const summary = albums.map(a => {
      const total = a.sections.reduce((x,s)=>x+s.count,0) + a.groups.reduce((x,g)=>x+g.teams.reduce((y,t)=>y+t.count,0),0);
      const owned = a.sections.reduce((x,s)=>x+s.progress.filter(p=>p.owned).length,0)
                  + a.groups.reduce((x,g)=>x+g.teams.reduce((y,t)=>y+t.progress.filter(p=>p.owned).length,0),0);
      return { id: a.id, name: a.name, slug: a.slug, createdAt: a.createdAt, total, owned, pct: total ? Math.round(owned/total*100) : 0 };
    });
    res.json({ albums: summary });
  } catch (e) { next(e); }
});

// POST /albums - cria álbum vazio ou via template
const CreateSchema = z.object({
  name: z.string().min(1),
  template: z.enum(["empty","copa-2026"]).default("empty"),
});
router.post("/", async (req, res, next) => {
  try {
    const data = CreateSchema.parse(req.body);
    const slug = (data.name + "-" + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60);

    if (data.template === "empty") {
      const album = await prisma.album.create({
        data: { ownerId: req.user.id, name: data.name, slug },
      });
      return res.json({ album });
    }
    // template copa-2026
    const album = await prisma.album.create({
      data: {
        ownerId: req.user.id,
        name: data.name,
        slug,
        sections: { create: copa2026Template.sections },
        groups: {
          create: copa2026Template.groups.map(g => ({
            letter: g.letter,
            position: g.position,
            teams: { create: g.teams },
          })),
        },
      },
      include: { sections: true, groups: { include: { teams: true } } },
    });
    res.json({ album });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

// GET /albums/:id - álbum completo (catálogo + progresso)
router.get("/:id", requireOwnedAlbum, async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.album.id },
      include: {
        sections: { orderBy: { position: "asc" }, include: { progress: true } },
        groups: {
          orderBy: { position: "asc" },
          include: {
            teams: {
              orderBy: { position: "asc" },
              include: { progress: true },
            },
          },
        },
      },
    });
    res.json({ album: shapeAlbum(album) });
  } catch (e) { next(e); }
});

// PATCH /albums/:id - renomeia
const PatchSchema = z.object({ name: z.string().min(1) });
router.patch("/:id", requireOwnedAlbum, async (req, res, next) => {
  try {
    const data = PatchSchema.parse(req.body);
    const album = await prisma.album.update({
      where: { id: req.album.id },
      data: { name: data.name },
    });
    res.json({ album });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

// DELETE /albums/:id
router.delete("/:id", requireOwnedAlbum, async (req, res, next) => {
  try {
    await prisma.album.delete({ where: { id: req.album.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function buildShareUrl(token) {
  const frontendUrl = (process.env.FRONTEND_URL || "https://figurinhass.app").replace(/\/$/, "");
  return `${frontendUrl}/compartilhar.html?token=${token}`;
}

// POST /albums/:id/share — gera ou retorna link público de faltantes/repetidas
router.post("/:id/share", requireOwnedAlbum, async (req, res, next) => {
  try {
    let shareToken = req.album.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(16).toString("hex");
      await prisma.album.update({
        where: { id: req.album.id },
        data: { shareToken },
      });
    }
    res.json({ shareToken, url: buildShareUrl(shareToken) });
  } catch (e) { next(e); }
});

// DELETE /albums/:id/share — revoga link público
router.delete("/:id/share", requireOwnedAlbum, async (req, res, next) => {
  try {
    await prisma.album.update({
      where: { id: req.album.id },
      data: { shareToken: null },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Helper — formato compatível com o frontend (sections como objeto)
function shapeAlbum(a) {
  const sections = {};
  a.sections.forEach(s => {
    const owned = {}, duplicates = {};
    s.progress.forEach(p => {
      if (p.owned) owned[p.num] = true;
      if (p.duplicates) duplicates[p.num] = p.duplicates;
    });
    sections[s.key] = { id: s.id, name: s.name, count: s.count, start: s.start, owned, duplicates, isPostGroup: s.isPostGroup };
  });
  const groups = a.groups.map(g => ({
    id: g.id,
    letter: g.letter,
    teams: g.teams.map(t => {
      const owned = {}, duplicates = {};
      t.progress.forEach(p => {
        if (p.owned) owned[p.num] = true;
        if (p.duplicates) duplicates[p.num] = p.duplicates;
      });
      return { id: t.id, name: t.name, code: t.code, count: t.count, start: t.start, owned, duplicates };
    }),
  }));
  return { id: a.id, name: a.name, slug: a.slug, sections, groups };
}

export default router;
