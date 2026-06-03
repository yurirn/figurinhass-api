import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Não autenticado" });
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (e) {
    res.status(401).json({ error: "Token inválido" });
  }
}

// Garante que o álbum pertence ao usuário autenticado
export async function requireOwnedAlbum(req, res, next) {
  try {
    const albumId = req.params.albumId || req.params.id || req.body.albumId;
    if (!albumId) return res.status(400).json({ error: "albumId requerido" });
    const album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album || album.ownerId !== req.user.id)
      return res.status(404).json({ error: "Álbum não encontrado" });
    req.album = album;
    next();
  } catch (e) { next(e); }
}
