// backend/api/auth.js
const express = require("express");
const router = express.Router();
const { supabase } = require("../lib/supabase");

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name, company } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name, company },
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  // Create user profile
  await supabase.from("users").insert({
    id: data.user.id,
    email,
    name,
    company,
  });

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
  if (token) await supabase.auth.admin.signOut(token);
  res.json({ success: true });
});

// GET /api/auth/me — get current user
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

  res.json({ user: { ...user, ...profile } });
});

module.exports = router;

// ── AUTH MIDDLEWARE ──────────────────────────────────────────
// Use this in server.js to protect routes
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
