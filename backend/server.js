// backend/server.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { router: authRouter, requireAuth } = require("./api/auth");
const dealsRouter = require("./api/deals");

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
  res.json({
    status: "ok",
    version: "1.0.0",
    service: "DealIQ API",
    env: {
      supabase_url:  process.env.SUPABASE_URL ? "set" : "MISSING",
      supabase_key:  process.env.SUPABASE_SERVICE_KEY ? "set" : "MISSING",
      supabase_anon: process.env.SUPABASE_ANON_KEY ? "set" : "MISSING",
      anthropic_key: process.env.ANTHROPIC_API_KEY ? "set" : "MISSING",
    },
  });
});

app.get("/api/debug-supabase", async (req, res) => {
  try {
    const url = `${process.env.SUPABASE_URL}/auth/v1/signup`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ email: "debugonly@test.com", password: "Test1234!" }),
    });
    const text = await response.text();
    res.json({ status: response.status, preview: text.substring(0, 300) });
  } catch (err) {
    res.json({ fetch_error: err.message });
  }
});

// ── PROTECTED ROUTES ─────────────────────────────────────────
app.use("/api/deals", requireAuth, dealsRouter);

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
