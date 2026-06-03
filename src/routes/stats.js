import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireOwnedAlbum } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /stats/:albumId  — estatísticas completas do álbum
router.get("/:albumId", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.albumId },
      include: {
        sections: { include: { progress: true }, orderBy: { position: "asc" } },
        groups: {
          orderBy: { position: "asc" },
          include: { teams: { include: { progress: true }, orderBy: { position: "asc" } } },
        },
      },
    });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });

    const stat = (count, progress) => {
      const owned = progress.filter(p => p.owned).length;
      const dups = progress.reduce((a,p) => a + (p.duplicates || 0), 0);
      return { total: count, owned, missing: count - owned, duplicates: dups };
    };
    let total = 0, owned = 0, dups = 0;
    const sections = album.sections.map(s => {
      const st = stat(s.count, s.progress);
      total += st.total; owned += st.owned; dups += st.duplicates;
      return { id: s.id, key: s.key, name: s.name, ...st };
    });
    const groups = album.groups.map(g => {
      const teams = g.teams.map(t => {
        const st = stat(t.count, t.progress);
        total += st.total; owned += st.owned; dups += st.duplicates;
        return { id: t.id, name: t.name, code: t.code, ...st };
      });
      return { id: g.id, letter: g.letter, teams,
        total: teams.reduce((a,t)=>a+t.total,0),
        owned: teams.reduce((a,t)=>a+t.owned,0) };
    });
    res.json({
      summary: { total, owned, missing: total - owned, duplicates: dups, pct: total ? owned/total*100 : 0 },
      sections, groups,
    });
  } catch (e) { next(e); }
});

// GET /stats/:albumId/missing  — só faltantes
router.get("/:albumId/missing", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.albumId },
      include: {
        sections: { include: { progress: true }, orderBy: { position: "asc" } },
        groups: { include: { teams: { include: { progress: true } } }, orderBy: { position: "asc" } },
      },
    });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });
    res.json({ items: collectList(album, "missing") });
  } catch (e) { next(e); }
});

// GET /stats/:albumId/duplicates  — só repetidas
router.get("/:albumId/duplicates", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.albumId },
      include: {
        sections: { include: { progress: true }, orderBy: { position: "asc" } },
        groups: { include: { teams: { include: { progress: true } } }, orderBy: { position: "asc" } },
      },
    });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });
    res.json({ items: collectList(album, "duplicates") });
  } catch (e) { next(e); }
});

function collectList(album, kind) {
  const items = [];
  const collect = (count, start, progress, label, group) => {
    const owned = {}, dups = {};
    progress.forEach(p => { if (p.owned) owned[p.num] = true; if (p.duplicates) dups[p.num] = p.duplicates; });
    const list = [];
    for (let i = 1; i <= count; i++) {
      const dn = (start ?? 1) + i - 1;
      const disp = dn === 0 ? "00" : String(dn);
      if (kind === "missing" && !owned[i]) list.push({ num: disp, qty: 1, special: group !== null && i === 1 });
      if (kind === "duplicates" && dups[i]) list.push({ num: disp, qty: dups[i], special: group !== null && i === 1 });
    }
    if (list.length) items.push({ label, group, list, total: list.reduce((a,x)=>a+x.qty,0) });
  };
  album.sections.filter(s => !s.isPostGroup).forEach(s => collect(s.count, s.start, s.progress, s.name, null));
  album.groups.forEach(g => g.teams.forEach(t => collect(t.count, t.start, t.progress, t.name, g.letter)));
  album.sections.filter(s => s.isPostGroup).forEach(s => collect(s.count, s.start, s.progress, s.name, null));
  return items;
}

export default router;
