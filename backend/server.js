// backend/server.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { router: authRouter, requireAuth } = require("./api/auth");
const dealsRouter = require("./api/deals");
const cronRouter  = require("./api/cron");

const app = express();

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()),
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : "*" }));
app.use(express.json());

// ── PUBLIC ROUTES ────────────────────────────────────────────
app.use("/api/auth", authRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", service: "DealIQ API" });
});

// ── PROTECTED ROUTES ─────────────────────────────────────────
app.use("/api/deals", requireAuth, dealsRouter);
app.use("/api/cron", cronRouter);

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong", detail: err.message });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║     DealIQ API — Running on ${PORT}    ║
  ╠══════════════════════════════════════╣
  ║  POST /api/auth/signup               ║
  ║  POST /api/auth/login                ║
  ║  GET  /api/deals                     ║
  ║  POST /api/deals/:id/analyze         ║
  ║  GET  /api/health                    ║
  ╚══════════════════════════════════════╝
    `);
  });
}

module.exports = app;
