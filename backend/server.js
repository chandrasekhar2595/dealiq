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
  res.json({ status: "ok", version: "1.2.0", service: "DealIQ API", slack: "enabled" });
});

// Test Slack webhook directly
app.post("/api/test-slack", async (req, res) => {
  const { webhook_url } = req.body;
  if (!webhook_url) return res.status(400).json({ error: "webhook_url required" });
  const { sendSlackAlert } = require("./services/slack");
  await sendSlackAlert(webhook_url, {
    deal: { company: "Test Deal", contact_name: "Test Contact", contact_role: "CEO",
      value: 50000, stage: "Proposal Sent", days_stale: 12 },
    analysis: { risk_level: "high", close_score: 32, urgency: "immediate",
      stall_reason: "This is a test alert from DealIQ.",
      recommended_action: "If you see this in Slack, the integration is working." },
    type: "analysis",
  });
  res.json({ sent: true });
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
