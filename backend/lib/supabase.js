const { createClient } = require("@supabase/supabase-js");

const supabaseUrl      = process.env.SUPABASE_URL;
const supabaseAnonKey  = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
}

// Used for auth operations (signUp, signIn) — public key
const supabase = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Used for DB queries and admin operations — bypasses RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabase, supabaseAdmin };
