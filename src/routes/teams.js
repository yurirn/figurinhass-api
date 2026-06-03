import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

async function ensureTeamOwner(req, res, next) {
  const t = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: { group: { include: { album: { select: { ownerId: true } } } } },
  });
  if (!t || t.group.album.ownerId !== req.user.id) return res.status(404).json({ error: "Time não encontrado" });
  req.team = t;
  next();
}

const PostSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1),
  code: z.string().optional(),
  count: z.number().int().min(0).default(20),
  start: z.number().int().min(0).default(1),
  position: z.number().int().default(0),
});
router.post("/", async (req, res, next) => {
  try {
    const data = PostSchema.parse(req.body);
    const g = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: { album: { select: { ownerId: true } } },
    });
    if (!g || g.album.ownerId !== req.user.id) return res.status(404).json({ error: "Grupo não encontrado" });
    const team = await prisma.team.create({ data });
    res.json({ team });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  count: z.number().int().min(0).optional(),
  start: z.number().int().min(0).optional(),
  position: z.number().int().optional(),
});
router.patch("/:id", ensureTeamOwner, async (req, res, next) => {
  try {
    const data = PatchSchema.parse(req.body);
    const team = await prisma.team.update({ where: { id: req.team.id }, data });
    res.json({ team });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.delete("/:id", ensureTeamOwner, async (req, res, next) => {
  try {
    await prisma.team.delete({ where: { id: req.team.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
