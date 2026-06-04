// backend/api/auth.js
const express = require("express");
const router = express.Router();
const { supabase, supabaseAdmin } = require("../lib/supabase");

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name, company } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, company } },
  });

  if (error) return res.status(400).json({ error: error.message });
  if (!data.user) return res.status(400).json({ error: "Signup failed. Try again." });

  await supabaseAdmin.from("users").insert({ id: data.user.id, email, name, company });

  res.status(201).json({ message: "Account created. Please sign in." });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(401).json({ error: "Invalid email or password" });

  res.json({
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      company: data.user.user_metadata?.company,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) await supabaseAdmin.auth.admin.signOut(token);
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabaseAdmin.from("users").select("*").eq("id", user.id).single();

  res.json({ user: { ...user, ...profile } });
});

// PUT /api/auth/settings — update user profile settings
router.put("/settings", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  const { slack_webhook_url } = req.body;

  const { data, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ slack_webhook_url: slack_webhook_url || null })
    .eq("id", user.id)
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ user: data });
});

// ── SLACK OAUTH ──────────────────────────────────────────────

// GET /api/auth/slack — redirect user to Slack OAuth page
router.get("/slack", (req, res) => {
  const clientId    = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI ||
    "https://dealiq-backend.vercel.app/api/auth/slack/callback";
  const token = req.query.token;

  if (!clientId) return res.status(500).json({ error: "SLACK_CLIENT_ID not configured" });
  if (!token)    return res.status(400).json({ error: "token required" });

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id",    clientId);
  url.searchParams.set("scope",        "incoming-webhook");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state",        token); // carry JWT through OAuth flow

  res.redirect(url.toString());
});

// GET /api/auth/slack/callback — Slack redirects here after user approves
router.get("/slack/callback", async (req, res) => {
  const { code, state: token, error } = req.query;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    "https://dealiq-frontend-omega.vercel.app";

  if (error) return res.redirect(`${appUrl}?slack=error&reason=${error}`);
  if (!code || !token) return res.redirect(`${appUrl}?slack=error&reason=missing_params`);

  try {
    // Verify the user from JWT state
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.redirect(`${appUrl}?slack=error&reason=invalid_token`);

    // Exchange code for access token
    const clientId     = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri  = process.env.SLACK_REDIRECT_URI ||
      "https://dealiq-backend.vercel.app/api/auth/slack/callback";

    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
        code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.ok) {
      return res.redirect(`${appUrl}?slack=error&reason=${tokenData.error}`);
    }

    const webhookUrl   = tokenData.incoming_webhook?.url;
    const channelName  = tokenData.incoming_webhook?.channel || "unknown";

    if (!webhookUrl) return res.redirect(`${appUrl}?slack=error&reason=no_webhook`);

    // Save webhook URL to user profile
    await supabaseAdmin
      .from("users")
      .update({ slack_webhook_url: webhookUrl, slack_channel: channelName })
      .eq("id", user.id);

    res.redirect(`${appUrl}?slack=connected&channel=${encodeURIComponent(channelName)}`);
  } catch (err) {
    console.error("Slack callback error:", err.message);
    res.redirect(`${appUrl}?slack=error&reason=server_error`);
  }
});

// DELETE /api/auth/slack — disconnect Slack
router.delete("/slack", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  await supabaseAdmin.from("users").update({ slack_webhook_url: null }).eq("id", user.id);
  res.json({ success: true });
});

module.exports = router;

// ── AUTH MIDDLEWARE ──────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });

  req.user = user;
  next();
}

module.exports.requireAuth = requireAuth;
module.exports.router = router;
