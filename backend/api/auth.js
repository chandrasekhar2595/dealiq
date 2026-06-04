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
