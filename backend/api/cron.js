const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../lib/supabase");
const { analyzeDeal } = require("../services/analyzer");
const { Resend } = require("resend");

// ── SECURITY ─────────────────────────────────────────────────
function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (secret && auth !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── POST /api/cron/update-stale ───────────────────────────────
// Runs daily at midnight — updates days_stale for every deal
router.post("/update-stale", verifyCron, async (req, res) => {
  const { data: deals, error } = await supabaseAdmin
    .from("deals")
    .select("id, last_activity_at")
    .not("last_activity_at", "is", null);

  if (error) return res.status(500).json({ error: error.message });

  const now = Date.now();
  let updateCount = 0;

  for (const d of deals) {
    const days_stale = Math.floor((now - new Date(d.last_activity_at).getTime()) / 86_400_000);
    const { error: updateError } = await supabaseAdmin
      .from("deals")
      .update({ days_stale })
      .eq("id", d.id);
    if (!updateError) updateCount++;
  }

  // Re-analyze deals that just crossed 7 days stale
  const staleDeals = deals.filter(d => {
    const days = Math.floor((now - new Date(d.last_activity_at).getTime()) / 86_400_000);
    return days === 7 || days === 14;
  });

  for (const d of staleDeals.slice(0, 5)) {
    try {
      const { data: deal } = await supabaseAdmin.from("deals").select("*").eq("id", d.id).single();
      const { data: signals } = await supabaseAdmin.from("signals").select("*").eq("deal_id", d.id);
      const result = await analyzeDeal(deal, signals || []);
      await supabaseAdmin.from("analyses").insert({
        deal_id: d.id,
        risk_level: result.risk_level,
        close_score: result.close_score,
        stall_reason: result.stall_reason,
        insight: result.insight,
        recommended_action: result.recommended_action,
        urgency: result.urgency,
        draft_email_subject: result.draft_email?.subject,
        draft_email_body: result.draft_email?.body,
        signal_count: (signals || []).length,
      });
    } catch (e) {
      console.error(`Re-analysis failed for deal ${d.id}:`, e.message);
    }
  }

  res.json({ updated: updateCount, reanalyzed: staleDeals.slice(0, 5).length });
});

// ── POST /api/cron/daily-digest ───────────────────────────────
// Runs daily at 7am — emails each user a summary of at-risk deals
router.post("/daily-digest", verifyCron, async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY not set" });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Get all users
  const { data: users, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, email, name");

  if (userErr) return res.status(500).json({ error: userErr.message });

  let sent = 0;
  let lastError = null;
  for (const user of users) {
    // Get their at-risk and stale deals
    const { data: deals } = await supabaseAdmin
      .from("deals")
      .select("*, analyses(risk_level, close_score, urgency, recommended_action, analyzed_at)")
      .eq("user_id", user.id)
      .order("days_stale", { ascending: false })
      .limit(10);

    if (!deals || deals.length === 0) continue;

    const atRisk = deals.filter(d => d.analyses?.[0]?.risk_level === "high");

    // Only email if there's something worth surfacing
    if (atRisk.length === 0 && deals.every(d => d.days_stale < 3)) continue;
    const totalValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);

    if (!deals || deals.length === 0) continue;

    const dealRows = deals.slice(0, 5).map(d => {
      const a = d.analyses?.[0];
      return `
        <tr style="border-bottom:1px solid #0f2040">
          <td style="padding:10px 12px;color:#f1f5f9;font-weight:600">${d.company}</td>
          <td style="padding:10px 12px;color:#7dd3fc;font-family:monospace">$${Number(d.value||0).toLocaleString()}</td>
          <td style="padding:10px 12px;font-family:monospace;color:${d.days_stale>7?"#ef4444":d.days_stale>3?"#f59e0b":"#22c55e"}">${d.days_stale}d stale</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:${a?.risk_level==="high"?"#ef4444":a?.risk_level==="medium"?"#f59e0b":"#22c55e"}">${a ? a.risk_level.toUpperCase() : "—"}</td>
        </tr>`;
    }).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="background:#020b18;margin:0;padding:32px 16px;font-family:Inter,sans-serif">
        <div style="max-width:600px;margin:0 auto">
          <div style="font-family:monospace;font-size:28px;font-weight:900;color:#f1f5f9;margin-bottom:6px">
            Deal<span style="color:#f5a623">IQ</span>
          </div>
          <div style="font-size:13px;color:#475569;margin-bottom:28px">Daily pipeline briefing</div>

          <div style="display:flex;gap:20px;margin-bottom:28px;flex-wrap:wrap">
            ${[
              { label: "Pipeline Value", value: `$${totalValue.toLocaleString()}`, color: "#7dd3fc" },
              { label: "Active Deals",   value: deals.length,    color: "#94a3b8" },
              { label: "High Risk",      value: atRisk.length,   color: atRisk.length > 0 ? "#ef4444" : "#475569" },
            ].map(s => `
              <div style="background:#060f1f;border:1px solid #0f2040;border-radius:10px;padding:14px 20px;min-width:140px">
                <div style="font-family:monospace;font-size:22px;font-weight:700;color:${s.color}">${s.value}</div>
                <div style="font-size:11px;color:#475569;margin-top:2px">${s.label}</div>
              </div>`).join("")}
          </div>

          <div style="background:#060f1f;border:1px solid #0f2040;border-radius:10px;overflow:hidden;margin-bottom:24px">
            <div style="padding:14px 16px;font-family:monospace;font-size:10px;letter-spacing:0.1em;color:#334155;border-bottom:1px solid #0f2040">
              TOP DEALS BY STALENESS
            </div>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid #0f2040">
                  <th style="padding:8px 12px;text-align:left;font-size:10px;font-family:monospace;color:#334155">COMPANY</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;font-family:monospace;color:#334155">VALUE</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;font-family:monospace;color:#334155">STALE</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;font-family:monospace;color:#334155">RISK</th>
                </tr>
              </thead>
              <tbody>${dealRows}</tbody>
            </table>
          </div>

          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://dealiq-frontend-omega.vercel.app"}"
            style="display:block;background:#f5a623;color:#020b18;text-decoration:none;
            text-align:center;padding:13px;border-radius:8px;font-family:monospace;
            font-weight:700;font-size:12px;letter-spacing:0.07em;margin-bottom:24px">
            OPEN DEALIQ →
          </a>

          <div style="font-size:11px;color:#1e3a5f;text-align:center">
            DealIQ · AI Deal Intelligence · You're receiving this because you have active deals.
          </div>
        </div>
      </body>
      </html>`;

    try {
      await resend.emails.send({
        from: "DealIQ <onboarding@resend.dev>",
        to: user.email,
        subject: `${atRisk.length > 0 ? `⚠ ${atRisk.length} deal${atRisk.length > 1 ? "s" : ""} at risk · ` : ""}Your DealIQ pipeline briefing`,
        html,
      });
      sent++;
    } catch (e) {
      console.error(`Email failed for ${user.email}:`, e.message);
      lastError = e.message;
    }
  }

  res.json({ users: users.length, emails_sent: sent, ...(lastError && { last_error: lastError }) });
});

module.exports = router;
