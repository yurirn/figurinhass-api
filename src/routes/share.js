import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { collectList } from "./stats.js";

const router = Router();

// GET /share/:token — leitura pública de faltantes e repetidas
router.get("/:token", async (req, res, next) => {
  try {
    const album = await prisma.album.findUnique({
      where: { shareToken: req.params.token },
      include: {
        sections: { include: { progress: true }, orderBy: { position: "asc" } },
        groups: {
          orderBy: { position: "asc" },
          include: { teams: { include: { progress: true }, orderBy: { position: "asc" } } },
        },
      },
    });
    if (!album) return res.status(404).json({ error: "Link inválido ou expirado" });

    res.json({
      album: { name: album.name },
      missing: collectList(album, "missing"),
      duplicates: collectList(album, "duplicates"),
    });
  } catch (e) { next(e); }
});

export default router;
