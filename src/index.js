import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import albumRoutes from "./routes/albums.js";
import sectionRoutes from "./routes/sections.js";
import teamRoutes from "./routes/teams.js";
import groupRoutes from "./routes/groups.js";
import progressRoutes from "./routes/progress.js";
import statsRoutes from "./routes/stats.js";
import importExportRoutes from "./routes/import-export.js";

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5500,http://localhost:3000")
  .split(",").map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origem não permitida (${origin})`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Health
app.get("/health", (_, res) => res.json({ ok: true, ts: Date.now() }));

// Rotas
app.use("/auth", authRoutes);
app.use("/albums", albumRoutes);
app.use("/sections", sectionRoutes);
app.use("/groups", groupRoutes);
app.use("/teams", teamRoutes);
app.use("/progress", progressRoutes);
app.use("/stats", statsRoutes);
app.use("/io", importExportRoutes);

// Erro handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Erro interno" });
});

app.listen(PORT, () => {
  console.log(`🚀 API on http://localhost:${PORT}`);
});
