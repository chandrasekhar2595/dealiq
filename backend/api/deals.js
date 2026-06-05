// backend/api/deals.js
const express = require("express");
const router = express.Router();
const { supabaseAdmin: supabase } = require("../lib/supabase");
const { analyzeDeal }             = require("../services/analyzer");
const { sendSlackAlert }          = require("../services/slack");
const { fetchEmailsForContact, extractSignals, refreshAccessToken } = require("../services/gmail");
const { fetchContactNews, extractLinkedInSignals } = require("../services/linkedin");

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

  // Fetch previous analysis for comparison
  const { data: prevAnalyses } = await supabase
    .from("analyses")
    .select("risk_level, close_score")
    .eq("deal_id", id)
    .order("analyzed_at", { ascending: false })
    .limit(1);
  const previousAnalysis = prevAnalyses?.[0] || null;

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

    // Top signal for Slack
    const topSignal = effectiveSignals[0]?.summary || null;

    // Send Slack alert for high/medium risk OR escalation from low → medium/high
    const escalated = previousAnalysis && previousAnalysis.risk_level !== result.risk_level
      && (result.risk_level === "high" || (result.risk_level === "medium" && previousAnalysis.risk_level === "low"));

    if (result.risk_level === "high" || result.risk_level === "medium" || escalated) {
      const { data: user } = await supabase
        .from("users")
        .select("slack_webhook_url")
        .eq("id", userId)
        .single();
      if (user?.slack_webhook_url) {
        await sendSlackAlert(user.slack_webhook_url, {
          deal, analysis, type: "analysis",
          topSignal,
          previousRiskLevel: previousAnalysis?.risk_level || null,
        });
      }
    }

    res.json({ analysis, previousScore: previousAnalysis?.close_score || null });
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

// POST /api/deals/:id/sync-gmail — pull real email signals from Gmail
router.post("/:id/sync-gmail", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Get deal
  const { data: deal, error: dealError } = await supabase
    .from("deals").select("*").eq("id", id).eq("user_id", userId).single();
  if (dealError || !deal) return res.status(404).json({ error: "Deal not found" });

  // Get user's Gmail tokens
  const { data: user } = await supabase
    .from("users").select("gmail_access_token, gmail_refresh_token").eq("id", userId).single();

  if (!user?.gmail_access_token) {
    return res.status(400).json({ error: "Gmail not connected. Connect Gmail in Settings first." });
  }

  try {
    let accessToken = user.gmail_access_token;

    // Try to refresh token if we have a refresh token
    if (user.gmail_refresh_token) {
      try {
        accessToken = await refreshAccessToken(user.gmail_refresh_token);
        await supabase.from("users").update({ gmail_access_token: accessToken }).eq("id", userId);
      } catch (e) {
        // Use existing token if refresh fails
      }
    }

    // Fetch emails for this contact
    const emails = await fetchEmailsForContact(accessToken, deal.contact_email);

    // Extract signals
    const newSignals = extractSignals(emails, deal.contact_email, deal.days_stale);

    if (!newSignals.length) {
      return res.json({ synced: 0, message: "No new signals found" });
    }

    // Delete old Gmail signals for this deal, insert fresh ones
    await supabase.from("signals")
      .delete().eq("deal_id", id).eq("source", "gmail");

    const { data: inserted } = await supabase.from("signals")
      .insert(newSignals.map(s => ({ ...s, deal_id: id })))
      .select();

    // Update last_activity_at if we found recent emails
    await supabase.from("deals")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    res.json({ synced: inserted?.length || 0, signals: inserted });
  } catch (err) {
    console.error("Gmail sync error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals/:id/sync-linkedin — pull news signals for contact + company
router.post("/:id/sync-linkedin", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: deal, error: dealError } = await supabase
    .from("deals").select("*").eq("id", id).eq("user_id", userId).single();
  if (dealError || !deal) return res.status(404).json({ error: "Deal not found" });

  try {
    const newsItems = await fetchContactNews(deal.contact_name, deal.company);
    const newSignals = extractLinkedInSignals(newsItems, deal.contact_name, deal.company);

    if (!newSignals.length) {
      return res.json({ synced: 0, message: "No news signals found for this contact or company" });
    }

    // Replace old linkedin signals with fresh ones
    await supabase.from("signals").delete().eq("deal_id", id).eq("source", "linkedin");

    const { data: inserted } = await supabase.from("signals")
      .insert(newSignals.map(s => ({ ...s, deal_id: id })))
      .select();

    res.json({ synced: inserted?.length || 0, signals: inserted });
  } catch (err) {
    console.error("LinkedIn sync error:", err.message);
    res.status(500).json({ error: err.message });
  }
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
