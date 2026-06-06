import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() { return localStorage.getItem("dealiq_token"); }
function setToken(t) { localStorage.setItem("dealiq_token", t); }
function clearToken() { localStorage.removeItem("dealiq_token"); }

function getDaysStale(deal) {
  return deal.days_stale || 0;
}

const ERROR_MAP = {
  "Failed to fetch": "Unable to connect to server. Please try again.",
  "Load failed":     "Unable to connect to server. Please try again.",
  "NetworkError":    "Network error. Check your connection.",
};
function friendlyError(msg = "") {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg.includes(key)) return val;
  }
  return msg;
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const RISK = {
  high:   { color: "#ef4444", bg: "#ef444418", border: "#ef444440", glow: "rgba(239,68,68,0.3)" },
  medium: { color: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b40", glow: "rgba(245,158,11,0.3)" },
  low:    { color: "#22c55e", bg: "#22c55e18", border: "#22c55e40", glow: "rgba(34,197,94,0.3)" },
};

const STAGE_COLOR = {
  "Discovery":     "#7dd3fc",
  "Proposal Sent": "#a78bfa",
  "Negotiation":   "#fb923c",
  "Closing":       "#f59e0b",
  "Won":           "#22c55e",
  "Lost":          "#ef4444",
};

const SOURCE_ICON = { gmail: "✉", slack: "#", linkedin: "in", crm: "⊙", intent: "◎" };

// ── COMPANY AVATAR ───────────────────────────────────────────
function companyToDomain(company) {
  const cleaned = company
    .replace(/\b(inc|llc|ltd|corp|co|company|group|holdings|technologies|tech|solutions|services|platforms|global|international|enterprises|ventures)\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .trim();
  return cleaned ? `${cleaned}.com` : null;
}

function CompanyAvatar({ company, contactEmail, size = 40 }) {
  const emailDomain = contactEmail?.split("@")[1];
  const companyDomain = companyToDomain(company);
  const [srcIndex, setSrcIndex] = useState(0);

  const personalDomains = ["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","protonmail.com"];
  const domain = (emailDomain && !personalDomains.includes(emailDomain)) ? emailDomain : companyDomain;

  // Try Clearbit only — Google favicons returns CMS logos (WordPress etc), not company logos
  const sources = domain ? [`https://logo.clearbit.com/${domain}`] : [];

  const color = ["#0ea5e9","#8b5cf6","#f59e0b","#22c55e","#ef4444","#ec4899"][
    (company || "A").charCodeAt(0) % 6
  ];
  const style = { width: size, height: size, borderRadius: 10, flexShrink: 0,
    overflow: "hidden", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center" };

  if (srcIndex < sources.length) {
    return (
      <div style={{ ...style, background: "var(--bg-card)" }}>
        <img src={sources[srcIndex]} alt={company}
          onError={() => setSrcIndex(i => i + 1)}
          style={{ width: size - 8, height: size - 8, objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div style={{ ...style, background: `linear-gradient(135deg, ${color}30, ${color}15)`,
      borderColor: `${color}40`, fontFamily: "var(--font-mono)",
      fontWeight: 900, fontSize: size * 0.4, color }}>
      {(company || "?")[0].toUpperCase()}
    </div>
  );
}

// ── SCORE RING ───────────────────────────────────────────────
function ScoreRing({ score, size = 80, riskLevel }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = riskLevel === "high" ? "#ef4444" : riskLevel === "medium" ? "#f59e0b" : riskLevel === "low" ? "#22c55e" : (score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444");
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size}
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`,
          fill: color, fontSize: size * 0.22, fontWeight: "700",
          fontFamily: "var(--font-mono)" }}>
        {score}
      </text>
    </svg>
  );
}

// ── SKELETON LOADER ──────────────────────────────────────────
function Skeleton({ w = "100%", h = 14, mb = 8 }) {
  return <div className="skeleton" style={{ width: w, height: h, marginBottom: mb }} />;
}

// ── LOGO MARK (Direction C — eye + pulse) ────────────────────
function LogoMark({ size = 36 }) {
  const s = size;
  const cx = s * 0.5, cy = s * 0.5;
  const w = s * 0.44, h = s * 0.25;
  const id = `logo-${s}`;

  // Eye: two smooth arcs
  const eyePath = `M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy} Q ${cx} ${cy + h} ${cx - w} ${cy} Z`;

  // Pulse: enters flat, sharp spike up, drops below baseline, returns flat
  const pw = w * 0.82;
  const ph = h * 0.82;
  const pulsePath = [
    `M ${cx - pw} ${cy}`,
    `L ${cx - pw * 0.28} ${cy}`,
    `L ${cx - pw * 0.08} ${cy - ph}`,
    `L ${cx + pw * 0.08} ${cy + ph * 0.5}`,
    `L ${cx + pw * 0.24} ${cy}`,
    `L ${cx + pw} ${cy}`,
  ].join(" ");

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none"
      style={{ filter: `drop-shadow(0 0 ${s * 0.12}px rgba(245,166,35,0.25))`, overflow: "visible" }}>
      <defs>
        <clipPath id={`clip-${id}`}><path d={eyePath} /></clipPath>
        <linearGradient id={`pg-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f5a623" stopOpacity="0.2" />
          <stop offset="35%"  stopColor="#f5a623" stopOpacity="1"   />
          <stop offset="65%"  stopColor="#ff6b35" stopOpacity="1"   />
          <stop offset="100%" stopColor="#ff6b35" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`eg-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#2a4a6e" />
          <stop offset="100%" stopColor="#0d1f35" />
        </linearGradient>
      </defs>

      {/* Eye fill — subtle blue inner glow */}
      <path d={eyePath} fill={`url(#eg-${id})`} />

      {/* Eye border — visible light blue stroke */}
      <path d={eyePath} stroke="rgba(125,211,252,0.35)" strokeWidth={s * 0.038} />

      {/* Pulse line clipped inside eye */}
      <g clipPath={`url(#clip-${id})`}>
        <path d={pulsePath}
          stroke={`url(#pg-${id})`}
          strokeWidth={s * 0.052}
          strokeLinecap="round" strokeLinejoin="round"
          fill="none"
          style={{ filter: `drop-shadow(0 0 ${s * 0.09}px rgba(245,166,35,0.9))` }} />
      </g>

      {/* Pupil dot at spike peak */}
      <circle
        cx={cx - s * 0.04} cy={cy - ph * 0.45}
        r={s * 0.028}
        fill="#f5a623"
        style={{ filter: `drop-shadow(0 0 ${s * 0.06}px #f5a623)` }}
        clipPath={`url(#clip-${id})`}
      />
    </svg>
  );
}

// ── LOGO FULL (mark + wordmark) ──────────────────────────────
function Logo({ size = 36, showWordmark = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      <LogoMark size={size} />
      {showWordmark && (
        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 900,
          fontSize: size * 0.52, letterSpacing: -0.5, lineHeight: 1 }}>
          <span style={{ color: "var(--text-1)" }}>Deal</span>
          <span style={{
            background: "linear-gradient(135deg, #f5a623, #ff6b35)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>IQ</span>
        </div>
      )}
    </div>
  );
}

// ── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [mode, setMode]       = useState("login");
  const [name, setName]       = useState("");
  const [company, setCompany] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "signup") {
        await api("/auth/signup", { method: "POST", body: { ...form, name, company } });
        setMode("login");
        setSuccess("Account created! Sign in to continue.");
      } else {
        const { token, user } = await api("/auth/login", { method: "POST", body: form });
        setToken(token);
        onLogin(user);
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", overflow: "hidden" }}>

      {/* Blobs */}
      <div style={{ position: "fixed", top: "-10%", right: "-5%", width: 700, height: 700,
        background: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-5%", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(245,166,35,0.1) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* ── LEFT PANEL — branding ─────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 64px", position: "relative", zIndex: 1,
        borderRight: "1px solid rgba(255,255,255,0.05)" }}
        className="login-left">

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 28 }}>
            <Logo size={64} />
          </div>

          <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-1)",
            letterSpacing: -1, lineHeight: 1.15, marginBottom: 12 }}>
            Find the dying deal.<br />
            <span style={{ background: "linear-gradient(135deg, #f5a623, #ff6b35)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Close it.
            </span>
          </div>
          <div style={{ fontSize: 15, color: "var(--text-3)", lineHeight: 1.6, maxWidth: 340 }}>
            AI-powered deal intelligence that tells you which deals are stalling — and exactly what to do about it.
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          {[
            { icon: "◎", color: "#7dd3fc", label: "Signal Detection", desc: "Gmail, Slack, CRM — all signals in one place" },
            { icon: "◈", color: "#f59e0b", label: "Risk Scoring",     desc: "AI scores every deal from 0–100 in seconds" },
            { icon: "✦", color: "#a78bfa", label: "AI Follow-ups",   desc: "Draft the perfect email for every stalled deal" },
          ].map(({ icon, color, label, desc }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${color}14`, border: `1px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)",
          letterSpacing: "0.08em", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          256-BIT ENCRYPTION · DATA NEVER SHARED · SOC 2 IN PROGRESS
        </div>
      </div>

      {/* ── RIGHT PANEL — form ────────────────────────────────── */}
      <div style={{ width: 460, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 48px", position: "relative", zIndex: 1,
        background: "rgba(4,10,22,0.6)", backdropFilter: "blur(24px)" }}
        className="login-right">

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
          color: "var(--text-muted)", marginBottom: 28, textTransform: "uppercase" }}>
          {mode === "login" ? "→ Welcome back" : "→ Get started free"}
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)",
          marginBottom: 6, letterSpacing: -0.3 }}>
          {mode === "login" ? "Sign in" : "Create account"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 28 }}>
          {mode === "login" ? "Enter your credentials to continue." : "Start closing more deals today."}
        </div>

        {error && (
          <div style={{ background: "#ef444414", border: "1px solid #ef444432",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ background: "#22c55e14", border: "1px solid #22c55e32",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#22c55e", display: "flex", alignItems: "center", gap: 8 }}>
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <input className="field-input" placeholder="Full name"
                value={name} onChange={e => setName(e.target.value)} />
              <input className="field-input" placeholder="Company"
                value={company} onChange={e => setCompany(e.target.value)} />
            </>
          )}
          <input className="field-input" type="email" placeholder="Email address"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="field-input" type="password" placeholder="Password"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
            style={{ marginBottom: 22 }} />

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-3)" }}>
          {mode === "login"
            ? <>No account?{" "}<span onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Sign up free →</span></>
            : <>Have an account?{" "}<span onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Sign in →</span></>
          }
        </div>
      </div>
    </div>
  );
}

// ── ADD DEAL MODAL ───────────────────────────────────────────
function AddDealModal({ onClose, onAdd }) {
  const [form, setForm]   = useState({ company: "", contact_name: "", contact_email: "",
    contact_role: "", linkedin_url: "", value: "", stage: "Discovery", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { deal } = await api("/deals", { method: "POST",
        body: { ...form, value: Number(form.value) || 0 } });
      onAdd(deal); onClose();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally { setLoading(false); }
  }

  const FIELDS = [
    { key: "company",       label: "Company",       required: true },
    { key: "contact_name",  label: "Contact Name",  required: true },
    { key: "contact_email", label: "Contact Email", required: true, type: "email" },
    { key: "contact_role",  label: "Contact Role" },
    { key: "linkedin_url",  label: "LinkedIn URL (optional)", type: "url" },
    { key: "value",         label: "Deal Value ($)", type: "number" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      backdropFilter: "blur(4px)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-card)",
        border: "1px solid var(--border)", borderRadius: 14, padding: 32,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)" }}>Add new deal</div>
          <button onClick={onClose} className="btn-sm btn-ghost"
            style={{ width: 32, height: 32, padding: 0, fontSize: 16, display: "flex",
              alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {error && (
          <div style={{ background: "#ef444414", border: "1px solid #ef444432",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#ef4444" }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {FIELDS.map(({ key, label, required, type }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-3)", letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 5 }}>
                {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
              </div>
              <input className="field-input" type={type || "text"}
                value={form[key]} required={required}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ marginBottom: 0 }} />
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 5 }}>Stage</div>
            <select className="field-input" value={form.stage}
              onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              style={{ marginBottom: 0 }}>
              {["Discovery","Proposal Sent","Negotiation","Closing","Won","Lost"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 5 }}>Notes</div>
            <textarea className="field-input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ marginBottom: 0, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-sm btn-ghost"
              style={{ flex: 1, padding: "11px 0", fontSize: 11 }}>CANCEL</button>
            <button type="submit" disabled={loading} className="btn-sm btn-accent"
              style={{ flex: 1, padding: "11px 0", fontSize: 11 }}>
              {loading ? "ADDING..." : "ADD DEAL"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EDIT DEAL MODAL ─────────────────────────────────────────
function EditDealModal({ deal, onClose, onSave }) {
  const [form, setForm]       = useState({
    company:       deal.company       || "",
    contact_name:  deal.contact_name  || "",
    contact_email: deal.contact_email || "",
    contact_role:  deal.contact_role  || "",
    linkedin_url:  deal.linkedin_url  || "",
    value:         deal.value         || "",
    stage:         deal.stage         || "Discovery",
    notes:         deal.notes         || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { deal: updated } = await api(`/deals/${deal.id}`, {
        method: "PUT",
        body: { ...form, value: Number(form.value) || 0 },
      });
      onSave(updated); onClose();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally { setLoading(false); }
  }

  const FIELDS = [
    { key: "company",       label: "Company",       required: true },
    { key: "contact_name",  label: "Contact Name",  required: true },
    { key: "contact_email", label: "Contact Email", required: true, type: "email" },
    { key: "contact_role",  label: "Contact Role" },
    { key: "linkedin_url",  label: "LinkedIn URL (optional)", type: "url" },
    { key: "value",         label: "Deal Value ($)", type: "number" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      backdropFilter: "blur(4px)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-card)",
        border: "1px solid var(--border)", borderRadius: 14, padding: 32,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)" }}>
            Edit deal
          </div>
          <button onClick={onClose} className="btn-sm btn-ghost"
            style={{ width: 32, height: 32, padding: 0, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {error && (
          <div style={{ background: "#ef444414", border: "1px solid #ef444432",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#ef4444" }}>⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {FIELDS.map(({ key, label, required, type }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-3)", letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 5 }}>
                {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
              </div>
              <input className="field-input" type={type || "text"}
                value={form[key]} required={required}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ marginBottom: 0 }} />
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 5 }}>Stage</div>
            <select className="field-input" value={form.stage}
              onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              style={{ marginBottom: 0 }}>
              {["Discovery","Proposal Sent","Negotiation","Closing","Won","Lost"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 5 }}>Notes</div>
            <textarea className="field-input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ marginBottom: 0, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-sm btn-ghost"
              style={{ flex: 1, padding: "11px 0", fontSize: 11 }}>CANCEL</button>
            <button type="submit" disabled={loading} className="btn-sm btn-accent"
              style={{ flex: 1, padding: "11px 0", fontSize: 11 }}>
              {loading ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ───────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel, danger = false }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      backdropFilter: "blur(4px)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "var(--bg-card)",
        border: `1px solid ${danger ? "#ef444432" : "var(--border)"}`,
        borderRadius: 14, padding: 28,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)",
          marginBottom: 8 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24,
          lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} className="btn-sm btn-ghost"
            style={{ flex: 1, padding: "11px 0", fontSize: 11 }}>CANCEL</button>
          <button onClick={onConfirm} className="btn-sm"
            style={{ flex: 1, padding: "11px 0", fontSize: 11, fontWeight: 700,
              background: danger ? "#ef4444" : "var(--accent)",
              color: danger ? "#fff" : "#020b18",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontFamily: "var(--font-mono)", letterSpacing: "0.07em" }}>
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PIPELINE SUMMARY (empty state) ───────────────────────────
function PipelineSummary({ deals }) {
  const total = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const atRisk = deals.filter(d => d.latest_analysis?.risk_level === "high").length;
  const byStage = ["Discovery","Proposal Sent","Negotiation","Closing"]
    .map(s => ({ stage: s, count: deals.filter(d => d.stage === s).length }))
    .filter(s => s.count > 0);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 32, padding: 40 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 8 }}>
          TOTAL PIPELINE VALUE
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: 900,
          color: "var(--blue-light)", letterSpacing: -1 }}>
          ${total.toLocaleString()}
        </div>
      </div>

      {deals.length > 0 ? (
        <>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Active Deals", value: deals.length, color: "var(--text-2)" },
              { label: "At High Risk", value: atRisk, color: atRisk > 0 ? "var(--risk-high)" : "var(--text-3)" },
              { label: "Unanalyzed", value: deals.filter(d => !d.latest_analysis).length, color: "var(--text-3)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 28,
                  fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {byStage.length > 0 && (
            <div style={{ width: "100%", maxWidth: 360 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 12 }}>
                PIPELINE BY STAGE
              </div>
              {byStage.map(({ stage, count }) => (
                <div key={stage} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--text-2)" }}>{stage}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                      color: STAGE_COLOR[stage] || "var(--text-3)" }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div style={{ height: "100%", borderRadius: 2,
                      width: `${(count / deals.length) * 100}%`,
                      background: STAGE_COLOR[stage] || "var(--blue)",
                      transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            ← SELECT A DEAL TO ANALYZE
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 8 }}>
            No deals yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Add your first deal to get started.
          </div>
        </div>
      )}
    </div>
  );
}

// ── DEAL DETAIL PANEL ────────────────────────────────────────
function DealDetail({ dealId, onBack, onUpdate, onDelete }) {
  const [deal, setDeal]           = useState(null);
  const [signals, setSignals]     = useState([]);
  const [analysis, setAnalysis]   = useState(null);
  const [tab, setTab]             = useState("insights");
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showEdit, setShowEdit]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncingLinkedIn, setSyncingLinkedIn] = useState(false);
  const [previousScore, setPreviousScore]   = useState(null);
  const [meetingPrep, setMeetingPrep]       = useState(null);
  const [loadingPrep, setLoadingPrep]       = useState(false);
  const [objection, setObjection]           = useState("");
  const [objectionResult, setObjectionResult] = useState(null);
  const [loadingObjection, setLoadingObjection] = useState(false);
  const [stageSuggestion, setStageSuggestion] = useState(null);
  const [timeline, setTimeline]             = useState([]);
  const [competitors, setCompetitors]       = useState([]);
  const [newCompetitor, setNewCompetitor]   = useState("");
  const [analyzingComp, setAnalyzingComp]   = useState(null);

  useEffect(() => {
    setLoading(true);
    api(`/deals/${dealId}`).then(({ deal, signals, latest_analysis }) => {
      setDeal(deal); setSignals(signals); setAnalysis(latest_analysis);
    }).catch(console.error).finally(() => setLoading(false));
    api(`/deals/${dealId}/timeline`).then(({ events }) => setTimeline(events || [])).catch(() => {});
    api(`/deals/${dealId}/competitors`).then(({ competitors }) => setCompetitors(competitors || [])).catch(() => {});
  }, [dealId]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const { analysis: a, previousScore } = await api(`/deals/${dealId}/analyze`, { method: "POST" });
      setPreviousScore(previousScore);
      setAnalysis(a); setTab("insights");
      onUpdate({ id: dealId, latest_analysis: a });
      checkStageSuggestion();
      api(`/deals/${dealId}/timeline`).then(({ events }) => setTimeline(events || [])).catch(() => {});
    } catch (err) {
      alert(friendlyError(err.message));
    } finally { setAnalyzing(false); }
  }

  async function handleDelete() {
    try {
      await api(`/deals/${dealId}`, { method: "DELETE" });
      onDelete(dealId);
      onBack();
    } catch (err) {
      alert(friendlyError(err.message));
    } finally { setShowConfirm(false); }
  }

  async function syncGmail() {
    setSyncing(true);
    try {
      const { synced, signals: newSignals } = await api(`/deals/${dealId}/sync-gmail`, { method: "POST" });
      if (synced > 0) {
        setSignals(prev => [...prev.filter(s => s.source !== "gmail"), ...newSignals]);
        runAnalysis();
      } else {
        alert("No new signals found for this contact.");
      }
    } catch (err) {
      const msg = friendlyError(err.message);
      if (msg.includes("Gmail not connected")) {
        alert("Connect Gmail in ⚙ Settings first.");
      } else {
        alert(msg);
      }
    } finally { setSyncing(false); }
  }

  async function syncLinkedIn() {
    setSyncingLinkedIn(true);
    try {
      const { synced, signals: newSignals } = await api(`/deals/${dealId}/sync-linkedin`, { method: "POST" });
      if (synced > 0) {
        setSignals(prev => [...prev.filter(s => s.source !== "linkedin"), ...newSignals]);
        runAnalysis();
      } else {
        alert("No news signals found for this contact or company.");
      }
    } catch (err) {
      alert(friendlyError(err.message));
    } finally { setSyncingLinkedIn(false); }
  }

  async function getMeetingPrep() {
    setLoadingPrep(true); setMeetingPrep(null); setTab("prep");
    try {
      const { brief } = await api(`/deals/${dealId}/meeting-prep`, { method: "POST" });
      setMeetingPrep(brief);
    } catch (err) { alert(friendlyError(err.message)); }
    finally { setLoadingPrep(false); }
  }

  async function submitObjection() {
    if (!objection.trim()) return;
    setLoadingObjection(true); setObjectionResult(null);
    try {
      const { result } = await api(`/deals/${dealId}/objection`, { method: "POST", body: { objection } });
      setObjectionResult(result);
    } catch (err) { alert(friendlyError(err.message)); }
    finally { setLoadingObjection(false); }
  }

  async function checkStageSuggestion() {
    try {
      const { suggestion } = await api(`/deals/${dealId}/suggest-stage`, { method: "POST" });
      if (suggestion?.should_update) setStageSuggestion(suggestion);
    } catch (err) { /* silent */ }
  }

  if (loading) return (
    <div className="main-panel" style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <Skeleton w="140px" h={20} mb={24} />
      <Skeleton w="60%" h={28} mb={12} />
      <Skeleton w="40%" h={14} mb={32} />
      <Skeleton h={80} mb={8} />
      <Skeleton h={80} mb={8} />
      <Skeleton h={160} mb={0} />
    </div>
  );

  if (!deal) return null;

  const r = analysis ? RISK[analysis.risk_level] : null;
  const stageCol = STAGE_COLOR[deal.stage] || "var(--text-3)";
  const SENT = {
    positive: { icon: "↑", color: "var(--risk-low)" },
    negative: { icon: "↓", color: "var(--risk-high)" },
    neutral:  { icon: "→", color: "var(--text-3)" },
  };

  const analyzedAgo = analysis?.analyzed_at
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(analysis.analyzed_at).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })()
    : null;

  const featuredSignal = signals.find(s =>
    s.source === "linkedin" && ["job_change","funding","company_growth"].includes(s.type)
  );

  return (
    <div className="main-panel" style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
        <button onClick={onBack} className="btn-sm btn-ghost" style={{ marginTop: 4, flexShrink: 0 }}>← Back</button>
        <CompanyAvatar company={deal.company} contactEmail={deal.contact_email} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-1)",
            letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 4 }}>
            {deal.company}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
            ${Number(deal.value || 0).toLocaleString()} opportunity
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{deal.contact_name}{deal.contact_role ? ` · ${deal.contact_role}` : ""}</span>
            <span style={{ color: "var(--border-hi)" }}>·</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "1px 8px",
              borderRadius: 4, background: `${stageCol}18`, color: stageCol }}>
              {deal.stage}
            </span>
            {getDaysStale(deal) > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                color: getDaysStale(deal) > 14 ? "var(--risk-high)" : getDaysStale(deal) > 7 ? "var(--risk-med)" : "var(--text-3)" }}>
                {getDaysStale(deal)}d stale
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 4 }}>
          <button onClick={() => setShowEdit(true)} className="btn-sm btn-ghost">Edit</button>
          <button onClick={() => setShowConfirm(true)} className="btn-sm"
            style={{ color: "var(--risk-high)", background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "6px 12px",
              cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>
        </div>
      </div>

      {/* Score hero — redesigned */}
      {analysis && (
        <div className="score-hero" style={{
          background: "var(--bg-card)", border: `1px solid var(--border)`,
          borderRadius: 14, padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {/* Big ring */}
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              <ScoreRing score={analysis.close_score} size={140} riskLevel={analysis.risk_level} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-3)", letterSpacing: "0.1em", marginTop: 6 }}>
                CLOSE PROBABILITY
                {previousScore !== null && previousScore !== analysis.close_score && (
                  <span style={{ marginLeft: 6, color: analysis.close_score > previousScore ? "var(--risk-low)" : "var(--risk-high)", fontWeight: 700 }}>
                    {analysis.close_score > previousScore ? "▲" : "▼"}{Math.abs(analysis.close_score - previousScore)}
                  </span>
                )}
              </div>
            </div>
            {/* Right side */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div className={analysis.risk_level === "high" ? "risk-badge-high" : ""}
                  style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px",
                  borderRadius: 6, background: r?.bg, color: r?.color,
                  border: `1px solid ${r?.border}`, letterSpacing: "0.04em" }}>
                  {analysis.risk_level === "high" ? "⚠ " : analysis.risk_level === "medium" ? "⚡ " : "✓ "}
                  {analysis.risk_level.toUpperCase()} RISK
                </div>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                  {(analysis.urgency || "").replace("_", " ")}
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: r?.color, marginBottom: 12, letterSpacing: -0.3 }}>
                {analysis.close_score >= 70 ? "Strong position" :
                 analysis.close_score >= 50 ? "Needs attention" : "At risk of stalling"}
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${analysis.close_score}%`,
                  background: r?.color, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, fontWeight: 500 }}>
                {analysis.stall_reason}
              </div>
              {analyzedAgo && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 8 }}>
                  Last analyzed {analyzedAgo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Featured LinkedIn signal */}
      {featuredSignal && (
        <div className="signal-card featured" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#f59e0b",
              letterSpacing: "0.12em", marginBottom: 5 }}>⚡ INTELLIGENCE SIGNAL</div>
            <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 600,
              lineHeight: 1.5 }}>{featuredSignal.summary}</div>
          </div>
          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>USE THIS</div>
        </div>
      )}

      {/* Signals */}
      {signals.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
            color: "var(--text-3)", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
            <span>SIGNALS ({signals.length})</span>
            <span style={{ color: "var(--text-muted)" }}>SENTIMENT</span>
          </div>
          {signals.slice(0, 6).map((sig, i) => (
            <div key={i} className={`signal-card ${sig.sentiment || "neutral"}`}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 7px",
                borderRadius: 4, background: "var(--bg-hover)", border: "1px solid var(--border)",
                color: sig.source === "linkedin" ? "#0a66c2" : "var(--blue)",
                flexShrink: 0, letterSpacing: "0.05em", fontWeight: 700 }}>
                {SOURCE_ICON[sig.source] || "·"} {sig.source?.toUpperCase()}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                {sig.summary}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4,
                flexShrink: 0, padding: "2px 8px", borderRadius: 4,
                background: sig.sentiment === "positive" ? "rgba(34,197,94,0.1)" :
                            sig.sentiment === "negative" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sig.sentiment === "positive" ? "rgba(34,197,94,0.25)" :
                         sig.sentiment === "negative" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}` }}>
                <span style={{ fontSize: 11, fontWeight: 700,
                  color: SENT[sig.sentiment || "neutral"]?.color }}>
                  {SENT[sig.sentiment || "neutral"]?.icon}
                </span>
                <span style={{ fontSize: 10, color: SENT[sig.sentiment || "neutral"]?.color,
                  fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  {sig.sentiment || "neutral"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 24, padding: "24px", borderRadius: 12,
          border: "1px dashed var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
            No signals yet
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
            Sync Gmail or LinkedIn to pull real signals for this deal
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={syncGmail} className="btn-sm btn-ghost" style={{ fontSize: 11 }}>
              ✉ Sync Gmail
            </button>
            <button onClick={syncLinkedIn} className="btn-sm btn-ghost" style={{ fontSize: 11 }}>
              <span style={{ color: "#0a66c2", fontWeight: 700 }}>in</span> Sync LinkedIn
            </button>
          </div>
        </div>
      )}

      {/* Tabs + action row */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ display: "flex" }}>
          {[["insights","💡","Insights"],["action","🎯","Next Action"],["draft","✉️","Draft Email"],["prep","📋","Meeting Prep"],["objection","🛡️","Objections"],["intel","🔎","Competitor Intel"],["timeline","🕐","Timeline"]].map(([t, icon, label]) => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              <span className="tab-icon">{icon}</span>{label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, paddingBottom: 4, alignItems: "center" }}>
          <button onClick={syncLinkedIn} disabled={syncingLinkedIn} className="btn-sm"
            style={{ color: "var(--text-3)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            {syncingLinkedIn ? <><span className="dot"/><span className="dot"/></> :
              <><span style={{ color: "#0a66c2", fontWeight: 700 }}>in</span> LinkedIn</>}
          </button>
          <button onClick={syncGmail} disabled={syncing} className="btn-sm"
            style={{ color: "var(--text-3)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            {syncing ? <><span className="dot"/><span className="dot"/></> : <>✉ Gmail</>}
          </button>
          <button onClick={runAnalysis} disabled={analyzing} className="btn-analyze">
            {analyzing
              ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="dot"/><span className="dot"/><span className="dot"/>
                </span>
              : "⚡ Analyze Deal"}
          </button>
        </div>
      </div>

      {/* Analysis content */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "24px 24px", minHeight: 180 }}>

        {!analysis && !analyzing && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 6 }}>
              No analysis yet
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Click Analyze to get Deal Intelligence on this deal
            </div>
          </div>
        )}

        {analyzing && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Analyzing with Deal Intelligence…
              </span>
            </div>
            <Skeleton w="80%" h={14} mb={10} />
            <Skeleton w="95%" h={14} mb={10} />
            <Skeleton w="70%" h={14} mb={24} />
            <Skeleton w="50%" h={14} mb={10} />
            <Skeleton w="90%" h={14} mb={10} />
            <Skeleton w="65%" h={14} mb={0} />
          </div>
        )}

        {/* Stage suggestion banner */}
        {stageSuggestion && (
          <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#f59e0b",
                letterSpacing: "0.1em" }}>STAGE SUGGESTION</span>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>
                Move to <strong style={{ color: "var(--text-1)" }}>{stageSuggestion.suggested_stage}</strong> — {stageSuggestion.reason}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="btn-sm" onClick={async () => {
                await api(`/deals/${dealId}`, { method: "PUT", body: { stage: stageSuggestion.suggested_stage } });
                setDeal(d => ({ ...d, stage: stageSuggestion.suggested_stage }));
                setStageSuggestion(null);
              }} style={{ background: "#f59e0b", color: "#000", border: "none",
                borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                Update
              </button>
              <button className="btn-sm btn-ghost" onClick={() => setStageSuggestion(null)}
                style={{ fontSize: 11 }}>Dismiss</button>
            </div>
          </div>
        )}

        {analysis && !analyzing && (
          <>
            {tab === "insights" && (
              <div>
                {/* AI Recommendation callout */}
                <div className="ai-rec">
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)",
                    letterSpacing: "0.06em", marginBottom: 8 }}>🎯 AI RECOMMENDATION</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>
                    {analysis.recommended_action}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                    {analysis.insight}
                  </div>
                </div>
                {/* 2×2 scannable cards */}
                <div className="insight-grid">
                  <div className="insight-card">
                    <div className="insight-card-icon">⚠️</div>
                    <div className="insight-card-label">Risk Factor</div>
                    <div className="insight-card-value">{analysis.stall_reason}</div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-card-icon">📈</div>
                    <div className="insight-card-label">Close Score</div>
                    <div className="insight-card-value" style={{ fontSize: 28, fontWeight: 800, color: r?.color }}>
                      {analysis.close_score}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-3)" }}>/100</span>
                      {previousScore !== null && previousScore !== analysis.close_score && (
                        <span style={{ fontSize: 13, marginLeft: 8,
                          color: analysis.close_score > previousScore ? "var(--risk-low)" : "var(--risk-high)" }}>
                          {analysis.close_score > previousScore ? "▲" : "▼"}{Math.abs(analysis.close_score - previousScore)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-card-icon">⚡</div>
                    <div className="insight-card-label">Urgency</div>
                    <div className="insight-card-value" style={{ fontWeight: 700, color: r?.color }}>
                      {analysis.urgency === "immediate" ? "Act today" :
                       analysis.urgency === "this_week" ? "This week" : "Monitor"}
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-card-icon">📡</div>
                    <div className="insight-card-label">Signals Detected</div>
                    <div className="insight-card-value" style={{ fontSize: 24, fontWeight: 800, color: "var(--blue)" }}>
                      {signals.length}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)", marginLeft: 4 }}>signals</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === "action" && (
              <div>
                <div className="ai-rec" style={{ marginBottom: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)",
                    letterSpacing: "0.06em", marginBottom: 8 }}>🎯 NEXT ACTION</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.7 }}>
                    {analysis.recommended_action}
                  </div>
                </div>
              </div>
            )}
            {tab === "prep" && (
              <div>
                {!meetingPrep && !loadingPrep && (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 16 }}>
                      Get a pre-call brief for this deal
                    </div>
                    <button onClick={getMeetingPrep} className="btn-analyze" style={{ fontSize: 13 }}>
                      Generate Meeting Prep
                    </button>
                  </div>
                )}
                {loadingPrep && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0" }}>
                    <span className="dot" /><span className="dot" /><span className="dot" />
                    <span style={{ fontSize: 13, color: "var(--text-3)" }}>Preparing your brief…</span>
                  </div>
                )}
                {meetingPrep && !loadingPrep && (
                  <div>
                    <Section label="Situation" content={meetingPrep.situation} />
                    <Section label="Contact Profile" content={meetingPrep.contact_profile} />
                    <Section label="Goal for This Call" content={meetingPrep.goal} />
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
                        color: "var(--blue)", marginBottom: 10 }}>TALKING POINTS</div>
                      {meetingPrep.talking_points?.map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--text-2)" }}>
                          <span style={{ color: "#22c55e", fontWeight: 700, flexShrink: 0 }}>→</span>{p}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
                        color: "var(--blue)", marginBottom: 10 }}>QUESTIONS TO ASK</div>
                      {meetingPrep.questions_to_ask?.map((q, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--text-2)" }}>
                          <span style={{ color: "#7dd3fc", flexShrink: 0 }}>?</span>{q}
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 8,
                      background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                      marginBottom: 16 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#a78bfa",
                        letterSpacing: "0.1em", marginBottom: 6 }}>OPENING LINE</div>
                      <div style={{ fontSize: 13, color: "var(--text-1)", fontStyle: "italic" }}>
                        "{meetingPrep.one_line_opener}"
                      </div>
                    </div>
                    <button onClick={getMeetingPrep} className="btn-sm btn-ghost" style={{ fontSize: 11 }}>
                      Regenerate
                    </button>
                  </div>
                )}
              </div>
            )}
            {tab === "objection" && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
                    color: "var(--blue)", marginBottom: 8 }}>WHAT OBJECTION ARE YOU FACING?</div>
                  <textarea
                    value={objection}
                    onChange={e => setObjection(e.target.value)}
                    placeholder='e.g. "The price is too high" or "We need to think about it"'
                    style={{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "var(--text-1)",
                      resize: "vertical", minHeight: 80, boxSizing: "border-box",
                      fontFamily: "inherit", outline: "none" }}
                  />
                  <button onClick={submitObjection} disabled={loadingObjection || !objection.trim()}
                    className="btn-analyze" style={{ marginTop: 10, fontSize: 13 }}>
                    {loadingObjection ? "Handling…" : "Handle This Objection"}
                  </button>
                </div>
                {objectionResult && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20,
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      fontFamily: "var(--font-mono)", fontSize: 10, color: "#ef4444",
                      letterSpacing: "0.08em", marginBottom: 16 }}>
                      {objectionResult.objection_type?.toUpperCase()} OBJECTION
                    </div>
                    <Section label="What They Really Mean" content={objectionResult.what_it_really_means} />
                    <Section label="Response Strategy" content={objectionResult.response_strategy} />
                    <div style={{ padding: "14px 16px", borderRadius: 8,
                      background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
                      marginBottom: 16 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#22c55e",
                        letterSpacing: "0.1em", marginBottom: 8 }}>WORD FOR WORD</div>
                      <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7, fontStyle: "italic" }}>
                        "{objectionResult.word_for_word}"
                      </div>
                    </div>
                    <Section label="Follow-up Question" content={objectionResult.follow_up_question} last />
                  </div>
                )}
              </div>
            )}
            {tab === "draft" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                      letterSpacing: "0.1em", color: "var(--blue)", marginBottom: 6 }}>
                      SUBJECT
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                      {analysis.draft_email_subject}
                    </div>
                  </div>
                  <button onClick={() => {
                    navigator.clipboard.writeText(
                      `Subject: ${analysis.draft_email_subject}\n\n${analysis.draft_email_body}`
                    );
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }} className="btn-sm"
                    style={{ marginLeft: 16, flexShrink: 0,
                      background: copied ? "#22c55e14" : "var(--bg-hover)",
                      border: `1px solid ${copied ? "#22c55e50" : "var(--border)"}`,
                      color: copied ? "#22c55e" : "var(--text-3)",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      letterSpacing: "0.07em", cursor: "pointer",
                      borderRadius: 6, padding: "5px 12px",
                      transition: "all 0.2s" }}>
                    {copied ? "COPIED ✓" : "COPY"}
                  </button>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                    letterSpacing: "0.1em", color: "var(--blue)", marginBottom: 10 }}>BODY</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-2)",
                    whiteSpace: "pre-wrap" }}>
                    {analysis.draft_email_body}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Competitor Intel tab */}
        {tab === "intel" && (
          <div>
            {/* Add competitor input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                value={newCompetitor}
                onChange={e => setNewCompetitor(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter" && newCompetitor.trim()) {
                    await api(`/deals/${dealId}/competitors`, { method: "POST", body: { name: newCompetitor.trim() } });
                    const { competitors: updated } = await api(`/deals/${dealId}/competitors`);
                    setCompetitors(updated || []);
                    setNewCompetitor("");
                  }
                }}
                placeholder="Add competitor (e.g. Salesforce, HubSpot)..."
                className="field-input"
                style={{ margin: 0, flex: 1 }}
              />
              <button className="btn-analyze" style={{ flexShrink: 0 }}
                onClick={async () => {
                  if (!newCompetitor.trim()) return;
                  await api(`/deals/${dealId}/competitors`, { method: "POST", body: { name: newCompetitor.trim() } });
                  const { competitors: updated } = await api(`/deals/${dealId}/competitors`);
                  setCompetitors(updated || []);
                  setNewCompetitor("");
                }}>
                + Add
              </button>
            </div>

            {competitors.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🔎</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
                  No competitors tracked yet
                </div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                  Add competitors above to get real-time intelligence and counter-messaging
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {competitors.map(comp => {
                  const a = comp.analysis;
                  const threatColor = comp.threat_level === "high" ? "var(--risk-high)" :
                                      comp.threat_level === "medium" ? "var(--risk-med)" : "var(--risk-low)";
                  const threatBg    = comp.threat_level === "high" ? "rgba(239,68,68,0.08)" :
                                      comp.threat_level === "medium" ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)";
                  return (
                    <div key={comp.id} style={{ background: "var(--bg-card)",
                      border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      {/* Header */}
                      <div style={{ padding: "14px 18px", display: "flex",
                        alignItems: "center", justifyContent: "space-between",
                        borderBottom: comp.analysis ? "1px solid var(--border)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <CompanyAvatar company={comp.name} contactEmail={`info@${comp.name.toLowerCase().replace(/\s+/g,"")}.com`} size={32} />
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{comp.name}</div>
                            {comp.threat_level && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: threatColor, marginTop: 2 }}>
                                {comp.threat_level.toUpperCase()} THREAT
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button className="btn-sm btn-ghost"
                            style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                            disabled={analyzingComp === comp.name}
                            onClick={async () => {
                              setAnalyzingComp(comp.name);
                              try {
                                const { competitor } = await api(
                                  `/deals/${dealId}/competitors/${encodeURIComponent(comp.name)}/analyze`,
                                  { method: "POST" }
                                );
                                setCompetitors(prev => prev.map(c => c.id === competitor.id ? competitor : c));
                              } catch (err) { alert(err.message); }
                              finally { setAnalyzingComp(null); }
                            }}>
                            {analyzingComp === comp.name
                              ? <><span className="dot"/><span className="dot"/><span className="dot"/></>
                              : "⚡ Analyze"}
                          </button>
                          <button className="btn-sm" style={{ color: "var(--risk-high)", fontSize: 12 }}
                            onClick={async () => {
                              await api(`/deals/${dealId}/competitors/${encodeURIComponent(comp.name)}`, { method: "DELETE" });
                              setCompetitors(prev => prev.filter(c => c.id !== comp.id));
                            }}>✕</button>
                        </div>
                      </div>

                      {/* Analysis */}
                      {a && (
                        <div style={{ padding: "16px 18px" }}>
                          {/* Threat reason */}
                          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16,
                            lineHeight: 1.6, padding: "10px 14px", borderRadius: 8,
                            background: threatBg, border: `1px solid ${threatColor}25` }}>
                            {a.threat_reason}
                          </div>

                          {/* Recent moves */}
                          {a.recent_moves?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)",
                                letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 8 }}>
                                RECENT MOVES
                              </div>
                              {a.recent_moves.map((move, i) => (
                                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5,
                                  fontSize: 13, color: "var(--text-2)" }}>
                                  <span style={{ color: "var(--text-3)", flexShrink: 0 }}>•</span>{move}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Likely objection */}
                          {a.likely_objection && (
                            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8,
                              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)",
                                letterSpacing: "0.08em", color: "var(--risk-high)", marginBottom: 6 }}>
                                LIKELY BUYER OBJECTION
                              </div>
                              <div style={{ fontSize: 13, color: "var(--text-1)", fontStyle: "italic" }}>
                                "{a.likely_objection}"
                              </div>
                            </div>
                          )}

                          {/* Counter message */}
                          {a.counter_message && (
                            <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 8,
                              background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)",
                                letterSpacing: "0.08em", color: "var(--risk-low)", marginBottom: 6 }}>
                                YOUR COUNTER-MESSAGE
                              </div>
                              <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6 }}>
                                {a.counter_message}
                              </div>
                            </div>
                          )}

                          {/* Win angle */}
                          {a.win_angle && (
                            <div style={{ padding: "12px 14px", borderRadius: 8,
                              background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)",
                                letterSpacing: "0.08em", color: "var(--blue)", marginBottom: 6 }}>
                                WIN ANGLE
                              </div>
                              <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6 }}>
                                {a.win_angle}
                              </div>
                            </div>
                          )}

                          {comp.synced_at && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)",
                              fontFamily: "var(--font-mono)", marginTop: 12 }}>
                              Last updated {new Date(comp.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Timeline tab — always visible, no analysis required */}
        {tab === "timeline" && (
          <div>
            {timeline.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🕐</div>
                <div style={{ fontSize: 14, color: "var(--text-2)", fontWeight: 600, marginBottom: 6 }}>
                  No activity yet
                </div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                  Events will appear here as you sync signals and run analyses
                </div>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 15, top: 8, bottom: 8,
                  width: 2, background: "var(--border)", borderRadius: 1 }} />
                {timeline.map((event) => {
                  const icons = {
                    created:       { icon: "🎯", color: "var(--blue)" },
                    analyzed:      { icon: "⚡", color: "var(--accent)" },
                    stage_change:  { icon: "📋", color: "#8b5cf6" },
                    gmail_sync:    { icon: "✉️", color: "#22c55e" },
                    linkedin_sync: { icon: "💼", color: "#0a66c2" },
                    signal:        { icon: "📡", color: "var(--risk-med)" },
                    stale:         { icon: "⏰", color: "var(--risk-high)" },
                  };
                  const { icon, color } = icons[event.event_type] || { icon: "·", color: "var(--text-3)" };
                  const timeAgo = (() => {
                    const mins = Math.floor((Date.now() - new Date(event.created_at)) / 60000);
                    if (mins < 1)   return "just now";
                    if (mins < 60)  return `${mins}m ago`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24)   return `${hrs}h ago`;
                    const days = Math.floor(hrs / 24);
                    if (days < 7)   return `${days}d ago`;
                    return new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  })();

                  return (
                    <div key={event.id} style={{ display: "flex", gap: 16, marginBottom: 20,
                      position: "relative" }}>
                      {/* Icon bubble */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "var(--bg-card)", border: `2px solid ${color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, zIndex: 1 }}>
                        {icon}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500,
                          lineHeight: 1.5, marginBottom: 3 }}>
                          {event.description}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)",
                          fontFamily: "var(--font-mono)" }}>
                          {timeAgo}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <EditDealModal
          deal={deal}
          onClose={() => setShowEdit(false)}
          onSave={updated => { setDeal(updated); onUpdate(updated); }}
        />
      )}

      {showConfirm && (
        <ConfirmDialog
          message={`Delete "${deal.company}"? This will remove all signals and analyses. This cannot be undone.`}
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

function Section({ label, content, last = false }) {
  return (
    <div style={{ paddingBottom: last ? 0 : 20, marginBottom: last ? 0 : 20,
      borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2,
          background: "linear-gradient(180deg, var(--blue), var(--blue-light))",
          boxShadow: "0 0 8px rgba(14,165,233,0.4)", flexShrink: 0 }} />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
          color: "var(--blue-light)", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text-2)", paddingLeft: 11 }}>{content}</div>
    </div>
  );
}

// ── GMAIL SECTION ────────────────────────────────────────────
function GmailSection({ user, justConnected, gmailEmail }) {
  const isConnected  = justConnected || !!user?.gmail_access_token;
  const email        = gmailEmail || "";
  const [disconnecting, setDisconnecting] = useState(false);

  function handleConnect() {
    const token = getToken();
    sessionStorage.setItem("dealiq_pre_oauth_token", token);
    window.location.href = `${API.replace("/api", "")}/api/auth/gmail?token=${token}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api("/auth/gmail", { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      alert(friendlyError(err.message));
    } finally { setDisconnecting(false); }
  }

  const GmailM = () => (
    <svg width="20" height="20" viewBox="52 42 88 66" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6z"/>
      <path fill="#34a853" d="M114 108h14c3.32 0 6-2.69 6-6V59l-20 15v34z"/>
      <path fill="#fbbc04" d="M114 48v26l20-15v-8c0-7.42-8.49-11.65-14.4-7.2l-5.6 4.2z"/>
      <path fill="#ea4335" d="M72 74V48l21 16 21-16v26L93 90 72 74z"/>
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2C60.49 39.35 52 43.58 52 51z"/>
    </svg>
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-hi)",
      borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, background: "#fff",
          borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, border: "1px solid #e0e0e0" }}>
          <GmailM />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Gmail Signals</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            Pull real email signals from your Gmail into deal analysis
          </div>
        </div>
        {isConnected && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 10px",
            borderRadius: 20, background: "var(--risk-low)14", color: "var(--risk-low)",
            border: "1px solid var(--risk-low)30" }}>✓ CONNECTED</div>
        )}
      </div>

      {isConnected ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
            <span>✉</span>
            <div style={{ fontSize: 13, color: "var(--text-1)" }}>
              {email || "Gmail connected"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12, lineHeight: 1.5 }}>
            Open any deal and click <strong style={{ color: "var(--text-2)" }}>Sync Gmail</strong> to pull real email signals.
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="btn-sm btn-ghost"
            style={{ fontSize: 11, padding: "8px 16px", color: "#ef4444", borderColor: "#ef444432" }}>
            {disconnecting ? "Disconnecting..." : "Disconnect Gmail"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.6 }}>
            Connect your Gmail to automatically detect reply patterns, email silence, and engagement signals for each deal.
          </div>
          <button onClick={handleConnect}
            style={{ display: "flex", alignItems: "center", gap: 10,
              background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
              padding: "10px 16px", cursor: "pointer", fontSize: 14,
              fontWeight: 600, color: "#1d1c1d", transition: "box-shadow 0.15s" }}
            onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"}
            onMouseOut={e => e.currentTarget.style.boxShadow = "none"}>
            <GmailM /> Connect Gmail
          </button>
          <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
            READ-ONLY ACCESS · EMAILS NEVER STORED · SIGNALS ONLY
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6,
            background: "rgba(251,188,4,0.08)", border: "1px solid rgba(251,188,4,0.25)",
            fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            <strong style={{ color: "#f59e0b" }}>⚠ Heads up:</strong> Google may show an "app isn't verified" warning.
            Click <strong>Advanced</strong> → <strong>Go to DealIQ</strong> to continue — this is safe.
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTINGS MODAL ───────────────────────────────────────────
function SettingsModal({ user, onClose, slackChannel, gmailEmail, justConnected }) {
  const isConnected = (justConnected === "slack") || !!user?.slack_webhook_url;
  const channel     = slackChannel || user?.slack_channel || "";
  const [disconnecting, setDisconnecting] = useState(false);

  function handleConnectSlack() {
    const token = getToken();
    // Store token in sessionStorage so it survives the OAuth redirect
    sessionStorage.setItem("dealiq_pre_oauth_token", token);
    window.location.href = `${API.replace("/api", "")}/api/auth/slack?token=${token}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api("/auth/slack", { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      alert(friendlyError(err.message));
    } finally { setDisconnecting(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, backdropFilter: "blur(4px)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-card)",
        border: "1px solid var(--border)", borderRadius: 14, padding: 32,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)" }}>Settings</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{user?.email}</div>
          </div>
          <button onClick={onClose} className="btn-sm btn-ghost"
            style={{ width: 32, height: 32, padding: 0, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Slack section */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-hi)",
          borderRadius: 10, padding: "16px 18px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: "#4A154B",
              borderRadius: 8, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              #
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Slack Alerts</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                Get notified when deals go high risk or stale
              </div>
            </div>
            {isConnected && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                padding: "3px 10px", borderRadius: 20,
                background: "var(--risk-low)14", color: "var(--risk-low)",
                border: "1px solid var(--risk-low)30" }}>
                ✓ CONNECTED
              </div>
            )}
          </div>

          {isConnected ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10,
                background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>#</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                    {channel || "Slack channel"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    Alerts will post here
                  </div>
                </div>
              </div>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="btn-sm btn-ghost"
                style={{ fontSize: 11, padding: "8px 16px", color: "#ef4444",
                  borderColor: "#ef444432" }}>
                {disconnecting ? "Disconnecting..." : "Disconnect Slack"}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.6 }}>
                Connect your Slack workspace to receive deal alerts directly in a channel of your choice.
              </div>
              <button onClick={handleConnectSlack}
                style={{ display: "flex", alignItems: "center", gap: 10,
                  background: "#fff", border: "none", borderRadius: 6,
                  padding: "10px 16px", cursor: "pointer", fontSize: 14,
                  fontWeight: 600, color: "#1d1c1d", transition: "box-shadow 0.15s" }}
                onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"}
                onMouseOut={e => e.currentTarget.style.boxShadow = "none"}>
                <svg width="20" height="20" viewBox="0 0 127 127">
                  <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2S.8 87.3.8 80s5.9-13.2 13.2-13.2H27.2V80z" fill="#E01E5A"/>
                  <path d="M33.7 80c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2v33.1c0 7.3-5.9 13.2-13.2 13.2s-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
                  <path d="M46.9 27.2c-7.3 0-13.2-5.9-13.2-13.2S39.6.8 46.9.8s13.2 5.9 13.2 13.2V27.2H46.9z" fill="#36C5F0"/>
                  <path d="M46.9 33.7c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H13.8C6.5 60.1.6 54.2.6 46.9s5.9-13.2 13.2-13.2H46.9z" fill="#36C5F0"/>
                  <path d="M99.8 46.9c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2-5.9 13.2-13.2 13.2H99.8V46.9z" fill="#2EB67D"/>
                  <path d="M93.3 46.9c0 7.3-5.9 13.2-13.2 13.2s-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6s13.2 5.9 13.2 13.2V46.9z" fill="#2EB67D"/>
                  <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2-13.2-5.9-13.2-13.2V99.8H80.1z" fill="#ECB22E"/>
                  <path d="M80.1 93.3c-7.3 0-13.2-5.9-13.2-13.2s5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E"/>
                </svg>
                Add to Slack
              </button>
            </div>
          )}

          {!isConnected && (
            <div style={{ marginTop: 12, fontSize: 10, color: "var(--text-muted)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
              ALERTS FIRE ON: HIGH / MEDIUM RISK · 7-DAY AND 14-DAY STALE
            </div>
          )}
        </div>

        {/* Gmail section */}
        <div style={{ marginTop: 10 }}>
          <GmailSection user={user} justConnected={justConnected === "gmail"} gmailEmail={gmailEmail} />
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ───────────────────────────────────────────
function Dashboard({ user, onLogout, openSettings = false, slackChannel = "", gmailEmail = "", justConnected = "", theme = "dark", onToggleTheme }) {
  const [deals, setDeals]           = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showSettings, setShowSettings] = useState(openSettings);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  const loadDeals = useCallback(async () => {
    try {
      const { deals } = await api("/deals");
      setDeals(deals);
    } catch (err) {
      if (err.message.includes("Authentication")) onLogout();
    } finally { setLoading(false); }
  }, [onLogout]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const sorted = [...deals].sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    return (o[a.latest_analysis?.risk_level] ?? 3) - (o[b.latest_analysis?.risk_level] ?? 3);
  });

  const q = query.toLowerCase().trim();
  const filtered = sorted.filter(d => {
    const matchesQuery = !q ||
      d.company.toLowerCase().includes(q) ||
      d.contact_name.toLowerCase().includes(q) ||
      (d.contact_email || "").toLowerCase().includes(q) ||
      (d.stage || "").toLowerCase().includes(q);
    const matchesStage = stageFilter === "All" || d.stage === stageFilter;
    return matchesQuery && matchesStage;
  });

  const totalValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const atRisk = deals.filter(d => d.latest_analysis?.risk_level === "high").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex",
      flexDirection: "column",
      backgroundImage: "radial-gradient(ellipse 80% 40% at 50% -5%, #0a1f3d 0%, transparent 65%)" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-glass)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10 }}>
        <div onClick={() => setSelectedId(null)} style={{ cursor: "pointer" }}>
          <Logo size={44} />
        </div>

        {/* Pipeline KPI stats */}
        <div className="header-stats" style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[
            { label: "Pipeline",   value: `$${totalValue >= 1000 ? (totalValue/1000).toFixed(0)+"K" : totalValue.toLocaleString()}`, color: "var(--text-1)" },
            { label: "Open Deals", value: deals.length, color: "var(--text-1)" },
            { label: "At Risk",    value: atRisk, color: atRisk > 0 ? "var(--risk-high)" : "var(--text-3)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center", padding: "6px 18px",
              borderRight: "1px solid var(--border)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: -0.5 }}>{value}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)",
            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </div>
          <button onClick={onToggleTheme} className="btn-sm btn-ghost"
            title="Toggle light/dark mode"
            style={{ padding: "6px 10px", fontSize: 15 }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setShowSettings(true)}
            className="btn-sm btn-ghost"
            style={{ padding: "6px 10px", fontSize: 14, display: "flex",
              alignItems: "center", gap: 6, color: "var(--text-2)",
              borderColor: "var(--border-hi)" }}>
            ⚙ <span style={{ fontSize: 10, fontFamily: "var(--font-mono)",
              letterSpacing: "0.07em" }}>Settings</span>
          </button>
          <button onClick={onLogout} className="btn-sm btn-ghost">Sign out</button>
        </div>
      </div>

      {/* Body */}
      <div className="dashboard-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div className={`deals-sidebar ${selectedId ? "hidden-mobile" : ""}`}
          style={{ width: 300, borderRight: "1px solid var(--border)",
            overflowY: "auto", padding: "14px 0", flexShrink: 0 }}>

          <div style={{ padding: "0 14px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.12em", color: "var(--text-3)" }}>
                {filtered.length}/{deals.length} DEALS
              </div>
              <button onClick={() => setShowAddDeal(true)} className="btn-sm btn-accent">
                + Add Deal
              </button>
            </div>

            {/* Search input */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <span style={{ position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)", fontSize: 12,
                color: "var(--text-3)", pointerEvents: "none" }}>⌕</span>
              <input
                className="field-input"
                placeholder="Search company, contact, stage…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ paddingLeft: 28, fontSize: 12, marginBottom: 0 }}
              />
              {query && (
                <button onClick={() => setQuery("")}
                  style={{ position: "absolute", right: 10, top: "50%",
                    transform: "translateY(-50%)", background: "none", border: "none",
                    color: "var(--text-3)", cursor: "pointer", fontSize: 14,
                    lineHeight: 1, padding: 0 }}>✕</button>
              )}
            </div>

            {/* Stage filter pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["All", "Discovery", "Proposal Sent", "Negotiation", "Closing"].map(s => (
                <button key={s} onClick={() => setStageFilter(s)}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em",
                    padding: "3px 9px", borderRadius: 20, border: "1px solid",
                    cursor: "pointer", transition: "all 0.15s",
                    borderColor: stageFilter === s ? (STAGE_COLOR[s] || "var(--blue)") : "var(--border)",
                    background:  stageFilter === s ? `${STAGE_COLOR[s] || "var(--blue)"}18` : "transparent",
                    color:       stageFilter === s ? (STAGE_COLOR[s] || "var(--blue)") : "var(--text-3)",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading && [1,2,3].map(i => (
            <div key={i} style={{ margin: "0 10px 8px", padding: 16,
              border: "1px solid var(--border)", borderRadius: 10 }}>
              <Skeleton w="60%" h={13} mb={8} />
              <Skeleton w="40%" h={11} mb={12} />
              <Skeleton w="80%" h={11} mb={0} />
            </div>
          ))}

          {!loading && deals.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 6 }}>
                No deals yet
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Add your first deal to start getting Deal Intelligence.
              </div>
            </div>
          )}

          {!loading && deals.length > 0 && filtered.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 4 }}>
                No matches
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Try a different name or stage
              </div>
            </div>
          )}

          {filtered.map(deal => {
            const a = deal.latest_analysis;
            const rk = a?.risk_level;
            return (
              <div key={deal.id} onClick={() => setSelectedId(deal.id)}
                className={`deal-card ${rk ? `risk-${rk}` : ""} ${selectedId === deal.id ? "selected" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)",
                      marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {deal.company}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
                      ${Number(deal.value || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {deal.contact_name}
                      {getDaysStale(deal) > 0 && (
                        <span style={{ marginLeft: 6, color: getDaysStale(deal) > 14 ? "var(--risk-high)" : getDaysStale(deal) > 7 ? "var(--risk-med)" : "var(--text-3)" }}>
                          · {getDaysStale(deal)}d stale
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    {rk && (
                      <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 5, background: RISK[rk].bg, color: RISK[rk].color }}>
                        {rk.toUpperCase()}
                      </div>
                    )}
                    {a
                      ? <ScoreRing score={a.close_score} size={52} riskLevel={a.risk_level} />
                      : <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>NO SCORE</div>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main panel */}
        {selectedId
          ? <DealDetail
              dealId={selectedId}
              onBack={() => setSelectedId(null)}
              onUpdate={updated => setDeals(ds => ds.map(d => d.id === updated.id ? { ...d, ...updated } : d))}
              onDelete={id => { setDeals(ds => ds.filter(d => d.id !== id)); setSelectedId(null); }}
            />
          : <PipelineSummary deals={deals} />
        }
      </div>

      {showAddDeal && (
        <AddDealModal
          onClose={() => setShowAddDeal(false)}
          onAdd={deal => { setDeals(d => [deal, ...d]); setSelectedId(deal.id); }}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={user}
          slackChannel={slackChannel}
          gmailEmail={gmailEmail}
          justConnected={justConnected}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [checking, setChecking] = useState(true);
  const [oauthResult, setOauthResult] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("dealiq_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dealiq_theme", theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slack = params.get("slack");
    const gmail = params.get("gmail");

    if (slack) {
      setOauthResult({ type: "slack", status: slack, value: params.get("channel") || "" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gmail) {
      setOauthResult({ type: "gmail", status: gmail, value: params.get("email") || "" });
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Restore token after OAuth redirect if needed
    const preOAuthToken = sessionStorage.getItem("dealiq_pre_oauth_token");
    if (preOAuthToken && slack) {
      setToken(preOAuthToken);
      sessionStorage.removeItem("dealiq_pre_oauth_token");
    }

    const token = getToken();
    if (!token) { setChecking(false); return; }
    api("/auth/me")
      .then(({ user }) => {
        setUser(user);
        // Refresh user after OAuth to get updated tokens
        if (slack === "connected" || gmail === "connected") {
          setTimeout(() => {
            api("/auth/me").then(({ user }) => setUser(user)).catch(() => {});
          }, 500);
        }
      })
      .catch((err) => {
        const msg = err?.message || "";
        if (msg.includes("expired") || msg.includes("Invalid") || msg.includes("Authentication")) {
          clearToken();
        }
      })
      .finally(() => setChecking(false));
  }, []);

  function handleLogout() {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    clearToken(); setUser(null); setOauthResult(null);
  }

  if (checking) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex",
      alignItems: "center", justifyContent: "center", gap: 10 }}>
      <span className="dot" /><span className="dot" /><span className="dot" />
    </div>
  );

  if (!user) return <LoginPage onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout}
    openSettings={!!oauthResult}
    slackChannel={oauthResult?.type === "slack" ? oauthResult.value : ""}
    gmailEmail={oauthResult?.type === "gmail" ? oauthResult.value : ""}
    justConnected={oauthResult?.type || ""}
    theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
  />;
}
