import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /io/export/:albumId  — exporta o álbum em JSON (catálogo + progresso)
router.get("/export/:albumId", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.albumId },
      include: {
        sections: { include: { progress: true }, orderBy: { position: "asc" } },
        groups: { include: { teams: { include: { progress: true }, orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
      },
    });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });

    const sections = {};
    album.sections.forEach(s => {
      const owned = {}, duplicates = {};
      s.progress.forEach(p => { if (p.owned) owned[p.num] = true; if (p.duplicates) duplicates[p.num] = p.duplicates; });
      sections[s.key] = { name: s.name, count: s.count, start: s.start, position: s.position, isPostGroup: s.isPostGroup, owned, duplicates };
    });
    const groups = album.groups.map(g => ({
      letter: g.letter,
      position: g.position,
      teams: g.teams.map(t => {
        const owned = {}, duplicates = {};
        t.progress.forEach(p => { if (p.owned) owned[p.num] = true; if (p.duplicates) duplicates[p.num] = p.duplicates; });
        return { name: t.name, code: t.code, count: t.count, start: t.start, position: t.position, owned, duplicates };
      }),
    }));
    res.json({ name: album.name, slug: album.slug, sections, groups });
  } catch (e) { next(e); }
});

// POST /io/import  — importa um álbum (formato single-album do frontend antigo)
const ImportSchema = z.object({
  name: z.string().min(1),
  sections: z.record(z.object({
    name: z.string(),
    count: z.number().int().min(0),
    start: z.number().int().min(0).default(1),
    position: z.number().int().default(0),
    isPostGroup: z.boolean().default(false),
    owned: z.record(z.any()).optional(),
    duplicates: z.record(z.any()).optional(),
  })).default({}),
  groups: z.array(z.object({
    letter: z.string(),
    position: z.number().int().default(0),
    teams: z.array(z.object({
      name: z.string(),
      code: z.string().optional(),
      count: z.number().int().min(0).default(20),
      start: z.number().int().min(0).default(1),
      position: z.number().int().default(0),
      owned: z.record(z.any()).optional(),
      duplicates: z.record(z.any()).optional(),
    })),
  })).default([]),
});

router.post("/import", async (req, res, next) => {
  try {
    const data = ImportSchema.parse(req.body);
    const slug = (data.name + "-" + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60);

    const album = await prisma.album.create({
      data: { ownerId: req.user.id, name: data.name, slug },
    });

    // cria seções + progresso
    for (const [key, sec] of Object.entries(data.sections)) {
      const created = await prisma.section.create({
        data: {
          albumId: album.id, key, name: sec.name, count: sec.count,
          start: sec.start, position: sec.position, isPostGroup: sec.isPostGroup,
        },
      });
      await createProgress("section", created.id, sec.owned, sec.duplicates);
    }
    // cria grupos + times + progresso
    let gPos = 0;
    for (const g of data.groups) {
      const grp = await prisma.group.create({
        data: { albumId: album.id, letter: g.letter, position: g.position ?? gPos++ },
      });
      let tPos = 0;
      for (const t of g.teams) {
        const tm = await prisma.team.create({
          data: {
            groupId: grp.id, name: t.name, code: t.code || null,
            count: t.count, start: t.start, position: t.position ?? tPos++,
          },
        });
        await createProgress("team", tm.id, t.owned, t.duplicates);
      }
    }
    res.json({ ok: true, albumId: album.id });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

async function createProgress(kind, parentId, owned = {}, duplicates = {}) {
  const nums = new Set([...Object.keys(owned||{}), ...Object.keys(duplicates||{})].map(n => parseInt(n)).filter(n => !isNaN(n)));
  if (!nums.size) return;
  const rows = Array.from(nums).map(num => ({
    [kind === "section" ? "sectionId" : "teamId"]: parentId,
    num,
    owned: !!owned[num],
    duplicates: parseInt(duplicates[num] || 0) || 0,
  }));
  await prisma.stickerProgress.createMany({ data: rows });
}

export default router;
