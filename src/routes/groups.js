import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

async function ensureGroupOwner(req, res, next) {
  const g = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: { album: { select: { ownerId: true } } },
  });
  if (!g || g.album.ownerId !== req.user.id) return res.status(404).json({ error: "Grupo não encontrado" });
  req.group = g;
  next();
}

const PostSchema = z.object({
  albumId: z.string(),
  letter: z.string().min(1),
  position: z.number().int().default(0),
});
router.post("/", async (req, res, next) => {
  try {
    const data = PostSchema.parse(req.body);
    const album = await prisma.album.findUnique({ where: { id: data.albumId } });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });
    const group = await prisma.group.create({ data });
    res.json({ group });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.delete("/:id", ensureGroupOwner, async (req, res, next) => {
  try {
    await prisma.group.delete({ where: { id: req.group.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
