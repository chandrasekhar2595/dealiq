// backend/api/deals.js
const express = require("express");
const router = express.Router();
const { supabase } = require("../lib/supabase");
const { analyzeDeal } = require("../services/analyzer");

// GET /api/deals — list all deals for user
router.get("/", async (req, res) => {
  const userId = req.user.id;

  const { data: deals, error } = await supabase
    .from("deals")
    .select(`
      *,
      analyses (
        risk_level, close_score, urgency, stall_reason,
        recommended_action, analyzed_at
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Attach latest analysis to each deal
  const dealsWithAnalysis = deals.map((d) => ({
    ...d,
    latest_analysis: d.analyses?.[d.analyses.length - 1] || null,
    analyses: undefined,
  }));

  res.json({ deals: dealsWithAnalysis });
});

// GET /api/deals/:id — single deal with signals and latest analysis
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: deal, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !deal) return res.status(404).json({ error: "Deal not found" });

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("deal_id", id)
    .order("detected_at", { ascending: false });

  const { data: analyses } = await supabase
    .from("analyses")
    .select("*")
    .eq("deal_id", id)
    .order("analyzed_at", { ascending: false })
    .limit(1);

  res.json({
    deal,
    signals: signals || [],
    latest_analysis: analyses?.[0] || null,
  });
});

// POST /api/deals — create a new deal
router.post("/", async (req, res) => {
  const userId = req.user.id;
  const { company, contact_name, contact_email, contact_role, value, stage, notes } = req.body;

  if (!company || !contact_name || !contact_email) {
    return res.status(400).json({ error: "company, contact_name, and contact_email are required" });
  }

  const { data, error } = await supabase
    .from("deals")
    .insert({ user_id: userId, company, contact_name, contact_email, contact_role, value, stage, notes })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ deal: data });
});

// PUT /api/deals/:id — update a deal
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updates = req.body;

  const { data, error } = await supabase
    .from("deals")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ deal: data });
});

// DELETE /api/deals/:id — delete a deal
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/deals/:id/analyze — run AI analysis on a deal
router.post("/:id/analyze", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Fetch deal
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (dealError || !deal) return res.status(404).json({ error: "Deal not found" });

  // Fetch signals
  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("deal_id", id)
    .order("detected_at", { ascending: false })
    .limit(10);

  // Use mock signals if none exist
  const effectiveSignals = (signals && signals.length > 0)
    ? signals
    : getMockSignals(deal);

  try {
    const result = await analyzeDeal(deal, effectiveSignals);

    // Save analysis to DB
    const { data: analysis, error: saveError } = await supabase
      .from("analyses")
      .insert({
        deal_id: id,
        risk_level: result.risk_level,
        close_score: result.close_score,
        stall_reason: result.stall_reason,
        insight: result.insight,
        recommended_action: result.recommended_action,
        urgency: result.urgency,
        draft_email_subject: result.draft_email?.subject,
        draft_email_body: result.draft_email?.body,
        signal_count: effectiveSignals.length,
      })
      .select()
      .single();

    if (saveError) throw new Error(saveError.message);

    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals/:id/signals — add a signal manually
router.post("/:id/signals", async (req, res) => {
  const { id } = req.params;
  const { source, type, summary, sentiment } = req.body;

  const { data, error } = await supabase
    .from("signals")
    .insert({ deal_id: id, source, type, summary, sentiment })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ signal: data });
});

// Mock signals for deals with no real data yet
function getMockSignals(deal) {
  const stale = deal.days_stale || 0;
  const signals = [];

  if (stale > 7) {
    signals.push({ source: "gmail", summary: `No reply from ${deal.contact_name} in ${stale} days after last outreach`, sentiment: "negative" });
  }
  if (stale > 3) {
    signals.push({ source: "crm", summary: `Deal has been in "${deal.stage}" stage for ${stale} days without progression`, sentiment: "negative" });
  }
  if (deal.stage === "Negotiation") {
    signals.push({ source: "crm", summary: "Deal is in negotiation — pricing sensitivity likely", sentiment: "neutral" });
  }
  if (deal.stage === "Discovery") {
    signals.push({ source: "gmail", summary: "Initial discovery call completed, follow-up materials sent", sentiment: "positive" });
  }

  return signals;
}

module.exports = router;
