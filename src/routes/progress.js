import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// Schema do toggle — recebe sectionId OU teamId
const ToggleSchema = z.object({
  sectionId: z.string().optional(),
  teamId: z.string().optional(),
  num: z.number().int().min(1),
  action: z.enum(["toggle","set","clear"]).default("toggle"),
  // para action=set: estados explícitos
  owned: z.boolean().optional(),
  duplicates: z.number().int().min(0).optional(),
}).refine(d => !!d.sectionId !== !!d.teamId, { message: "Informe sectionId OU teamId" });

async function ensureOwner(req, body) {
  if (body.sectionId) {
    const s = await prisma.section.findUnique({
      where: { id: body.sectionId },
      include: { album: { select: { ownerId: true } } },
    });
    if (!s || s.album.ownerId !== req.user.id) return null;
    return { kind: "section", sec: s, where: { sectionId_num: { sectionId: s.id, num: body.num } } };
  }
  const t = await prisma.team.findUnique({
    where: { id: body.teamId },
    include: { group: { include: { album: { select: { ownerId: true } } } } },
  });
  if (!t || t.group.album.ownerId !== req.user.id) return null;
  return { kind: "team", team: t, where: { teamId_num: { teamId: t.id, num: body.num } } };
}

// POST /progress/toggle  — 1º clique: owned; 2º+: duplicates++
router.post("/toggle", async (req, res, next) => {
  try {
    const body = ToggleSchema.parse(req.body);
    const ctx = await ensureOwner(req, body);
    if (!ctx) return res.status(404).json({ error: "Item não encontrado" });

    const existing = await prisma.stickerProgress.findUnique({ where: ctx.where });

    let data;
    if (body.action === "clear") {
      if (existing) await prisma.stickerProgress.delete({ where: ctx.where });
      return res.json({ ok: true, progress: { num: body.num, owned: false, duplicates: 0 } });
    }
    if (body.action === "set") {
      data = { owned: !!body.owned, duplicates: body.duplicates ?? 0 };
    } else {
      // toggle: lógica do app
      if (!existing) data = { owned: true, duplicates: 0 };
      else if (!existing.owned) data = { owned: true, duplicates: existing.duplicates };
      else data = { owned: true, duplicates: (existing.duplicates || 0) + 1 };
    }

    const upserted = await prisma.stickerProgress.upsert({
      where: ctx.where,
      create: {
        sectionId: ctx.kind === "section" ? ctx.sec.id : null,
        teamId:    ctx.kind === "team"    ? ctx.team.id : null,
        num: body.num,
        ...data,
      },
      update: data,
    });
    res.json({ ok: true, progress: { num: upserted.num, owned: upserted.owned, duplicates: upserted.duplicates } });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

// GET /progress/album/:albumId  — todo o progresso do álbum (para reload)
router.get("/album/:albumId", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.albumId },
      include: {
        sections: { include: { progress: true } },
        groups: { include: { teams: { include: { progress: true } } } },
      },
    });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });

    const sections = {};
    album.sections.forEach(s => {
      const owned = {}, duplicates = {};
      s.progress.forEach(p => {
        if (p.owned) owned[p.num] = true;
        if (p.duplicates) duplicates[p.num] = p.duplicates;
      });
      sections[s.id] = { owned, duplicates };
    });
    const teams = {};
    album.groups.forEach(g => g.teams.forEach(t => {
      const owned = {}, duplicates = {};
      t.progress.forEach(p => {
        if (p.owned) owned[p.num] = true;
        if (p.duplicates) duplicates[p.num] = p.duplicates;
      });
      teams[t.id] = { owned, duplicates };
    }));
    res.json({ sections, teams });
  } catch (e) { next(e); }
});

async function loadOwnedAlbum(req, albumId) {
  return prisma.album.findUnique({
    where: { id: albumId },
    include: {
      sections: true,
      groups: { include: { teams: true } },
    },
  });
}

// POST /progress/album/:albumId/reset — apaga todo o progresso
router.post("/album/:albumId/reset", async (req, res, next) => {
  try {
    const album = await loadOwnedAlbum(req, req.params.albumId);
    if (!album || album.ownerId !== req.user.id) {
      return res.status(404).json({ error: "Álbum não encontrado" });
    }

    const sectionIds = album.sections.map((s) => s.id);
    const teamIds = album.groups.flatMap((g) => g.teams.map((t) => t.id));

    await prisma.$transaction([
      prisma.stickerProgress.deleteMany({ where: { sectionId: { in: sectionIds } } }),
      prisma.stickerProgress.deleteMany({ where: { teamId: { in: teamIds } } }),
    ]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /progress/album/:albumId/complete — marca tudo como tenho
router.post("/album/:albumId/complete", async (req, res, next) => {
  try {
    const album = await loadOwnedAlbum(req, req.params.albumId);
    if (!album || album.ownerId !== req.user.id) {
      return res.status(404).json({ error: "Álbum não encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      for (const section of album.sections) {
        await tx.stickerProgress.deleteMany({ where: { sectionId: section.id } });
        if (section.count > 0) {
          await tx.stickerProgress.createMany({
            data: Array.from({ length: section.count }, (_, i) => ({
              sectionId: section.id,
              num: i + 1,
              owned: true,
              duplicates: 0,
            })),
          });
        }
      }
      for (const group of album.groups) {
        for (const team of group.teams) {
          await tx.stickerProgress.deleteMany({ where: { teamId: team.id } });
          if (team.count > 0) {
            await tx.stickerProgress.createMany({
              data: Array.from({ length: team.count }, (_, i) => ({
                teamId: team.id,
                num: i + 1,
                owned: true,
                duplicates: 0,
              })),
            });
          }
        }
      }
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
