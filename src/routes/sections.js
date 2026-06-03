import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// Owner check via secao -> album.ownerId
async function ensureSectionOwner(req, res, next) {
  const sec = await prisma.section.findUnique({
    where: { id: req.params.id },
    include: { album: { select: { ownerId: true } } },
  });
  if (!sec || sec.album.ownerId !== req.user.id) return res.status(404).json({ error: "Seção não encontrada" });
  req.section = sec;
  next();
}

const PostSchema = z.object({
  albumId: z.string(),
  key: z.string().min(1),
  name: z.string().min(1),
  count: z.number().int().min(0),
  start: z.number().int().min(0).default(1),
  position: z.number().int().default(0),
  isPostGroup: z.boolean().default(false),
});
router.post("/", async (req, res, next) => {
  try {
    const data = PostSchema.parse(req.body);
    const album = await prisma.album.findUnique({ where: { id: data.albumId } });
    if (!album || album.ownerId !== req.user.id) return res.status(404).json({ error: "Álbum não encontrado" });
    const section = await prisma.section.create({ data });
    res.json({ section });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    if (e.code === "P2002") return res.status(409).json({ error: "Já existe seção com essa chave" });
    next(e);
  }
});

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  count: z.number().int().min(0).optional(),
  start: z.number().int().min(0).optional(),
  position: z.number().int().optional(),
  isPostGroup: z.boolean().optional(),
});
router.patch("/:id", ensureSectionOwner, async (req, res, next) => {
  try {
    const data = PatchSchema.parse(req.body);
    const section = await prisma.section.update({ where: { id: req.section.id }, data });
    res.json({ section });
  } catch (e) {
    if (e.name === "ZodError") return res.status(400).json({ error: e.errors[0].message });
    next(e);
  }
});

router.delete("/:id", ensureSectionOwner, async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: req.section.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
