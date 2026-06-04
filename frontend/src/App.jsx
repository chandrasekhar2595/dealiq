import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() { return localStorage.getItem("dealiq_token"); }
function setToken(t) { localStorage.setItem("dealiq_token", t); }
function clearToken() { localStorage.removeItem("dealiq_token"); }

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

// ── SCORE RING ───────────────────────────────────────────────
function ScoreRing({ score, size = 80 }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const glowColor = score >= 70 ? "rgba(34,197,94,0.5)" : score >= 50 ? "rgba(245,158,11,0.5)" : "rgba(239,68,68,0.5)";
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size}
      style={{ transform: "rotate(-90deg)", flexShrink: 0,
        filter: `drop-shadow(0 0 ${size * 0.1}px ${glowColor})` }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0d1f35" strokeWidth="6" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
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
    contact_role: "", value: "", stage: "Discovery", notes: "" });
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
  const [syncing, setSyncing]     = useState(false);

  useEffect(() => {
    setLoading(true);
    api(`/deals/${dealId}`).then(({ deal, signals, latest_analysis }) => {
      setDeal(deal); setSignals(signals); setAnalysis(latest_analysis);
    }).catch(console.error).finally(() => setLoading(false));
  }, [dealId]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const { analysis: a } = await api(`/deals/${dealId}/analyze`, { method: "POST" });
      setAnalysis(a); setTab("insights");
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
      if (synced > 0) setSignals(newSignals);
      alert(synced > 0 ? `✓ Synced ${synced} Gmail signals` : "No new signals found for this contact.");
    } catch (err) {
      const msg = friendlyError(err.message);
      if (msg.includes("Gmail not connected")) {
        alert("Connect Gmail in ⚙ Settings first.");
      } else {
        alert(msg);
      }
    } finally { setSyncing(false); }
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
    positive: { icon: "↑", color: "#22c55e" },
    negative: { icon: "↓", color: "#ef4444" },
    neutral:  { icon: "→", color: "#7dd3fc" },
  };

  return (
    <div className="main-panel" style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <button onClick={onBack} className="btn-sm btn-ghost">← Back</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", flex: 1 }}>
          {deal.company}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 10px",
          borderRadius: 20, border: `1px solid ${stageCol}40`,
          color: stageCol, background: `${stageCol}14` }}>
          {deal.stage}
        </div>
        {r && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 10px",
            borderRadius: 20, background: r.bg, color: r.color,
            border: `1px solid ${r.border}`, letterSpacing: "0.06em" }}>
            {analysis.risk_level.toUpperCase()} RISK
          </div>
        )}
        <button onClick={() => setShowEdit(true)} className="btn-sm btn-ghost"
          style={{ marginLeft: "auto" }}>
          Edit
        </button>
        <button onClick={() => setShowConfirm(true)} className="btn-sm"
          style={{ background: "#ef444414", border: "1px solid #ef444432",
            color: "#ef4444", fontFamily: "var(--font-mono)", fontSize: 10,
            fontWeight: 700, letterSpacing: "0.07em", padding: "6px 14px",
            borderRadius: 6, cursor: "pointer", transition: "background 0.15s" }}>
          Delete
        </button>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span>{deal.contact_name}</span>
        {deal.contact_role && <><span>·</span><span>{deal.contact_role}</span></>}
        <span>·</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--blue-light)", fontWeight: 600 }}>
          ${Number(deal.value || 0).toLocaleString()}
        </span>
        {deal.days_stale > 0 && (
          <>
            <span>·</span>
            <span style={{ fontFamily: "var(--font-mono)",
              color: deal.days_stale > 14 ? "var(--risk-high)" : deal.days_stale > 7 ? "var(--risk-med)" : "var(--text-3)",
              fontWeight: deal.days_stale > 7 ? 600 : 400 }}>
              {deal.days_stale}d stale
            </span>
          </>
        )}
      </div>

      {/* Score hero */}
      {analysis && (
        <div className="score-hero" style={{
          background: "rgba(6,15,31,0.8)", backdropFilter: "blur(16px)",
          border: `1px solid ${r?.border || "rgba(255,255,255,0.06)"}`,
          borderRadius: 14, padding: "24px 28px", marginBottom: 24,
          boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${r?.glow || "transparent"}20` }}>

          {/* Top row: ring + verdict */}
          <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 20 }}>
            <ScoreRing score={analysis.close_score} size={104} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--text-3)", letterSpacing: "0.15em", marginBottom: 6 }}>
                CLOSE PROBABILITY
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3,
                color: r?.color, marginBottom: 10,
                textShadow: `0 0 24px ${r?.glow || "transparent"}` }}>
                {analysis.close_score >= 70 ? "Strong position" :
                 analysis.close_score >= 50 ? "Needs attention" : "At risk of stalling"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px",
                  borderRadius: 20, background: r?.bg, color: r?.color, border: `1px solid ${r?.border}`,
                  boxShadow: `0 0 10px ${r?.glow}` }}>
                  {(analysis.urgency || "").replace("_", " ").toUpperCase()}
                </span>
                {signals.length > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px",
                    borderRadius: 20, background: "rgba(14,165,233,0.08)",
                    color: "var(--blue-light)", border: "1px solid rgba(14,165,233,0.2)" }}>
                    {signals.length} SIGNALS
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px",
                  borderRadius: 20, background: RISK[analysis.risk_level]?.bg,
                  color: RISK[analysis.risk_level]?.color,
                  border: `1px solid ${RISK[analysis.risk_level]?.border}` }}>
                  {analysis.risk_level?.toUpperCase()} RISK
                </span>
              </div>
            </div>
          </div>

          {/* Score bar */}
          <div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3,
                width: `${analysis.close_score}%`,
                background: `linear-gradient(90deg, ${r?.color}80, ${r?.color})`,
                boxShadow: `0 0 8px ${r?.glow}`,
                transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>0</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>100</span>
            </div>
          </div>
        </div>
      )}

      {/* Signals */}
      {signals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
            color: "var(--text-3)", marginBottom: 10, textTransform: "uppercase" }}>
            Signals ({signals.length})
          </div>
          {signals.slice(0, 5).map((sig, i) => (
            <div key={i} className="signal-card">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px",
                borderRadius: 4, background: "var(--bg-hover)",
                color: "var(--blue-light)", flexShrink: 0, letterSpacing: "0.05em" }}>
                {SOURCE_ICON[sig.source] || "·"} {sig.source?.toUpperCase()}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "var(--text-2)",
                lineHeight: 1.5 }}>{sig.summary}</div>
              <div style={{ fontSize: 16, color: SENT[sig.sentiment || "neutral"]?.color,
                fontWeight: 700, flexShrink: 0 }}>
                {SENT[sig.sentiment || "neutral"]?.icon}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + analyze */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flex: 1 }}>
          {[["insights","AI Insights"],["action","Next Action"],["draft","Draft Email"]].map(([t, label]) => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
          <button onClick={syncGmail} disabled={syncing} className="btn-sm btn-ghost"
            title="Sync Gmail signals for this contact"
            style={{ fontSize: 10, padding: "7px 12px", display: "flex", alignItems: "center", gap: 5 }}>
            {syncing
              ? <><span className="dot" /><span className="dot" /></>
              : <><span>✉</span> Sync Gmail</>}
          </button>
          <button onClick={runAnalysis} disabled={analyzing} className="btn-analyze">
            {analyzing
              ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </span>
              : "⚡ Analyze"}
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
              Click Analyze to get AI intelligence on this deal
            </div>
          </div>
        )}

        {analyzing && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Analyzing deal with Claude AI…
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

        {analysis && !analyzing && (
          <>
            {tab === "insights" && (
              <div>
                <Section label="Stall Reason" content={analysis.stall_reason} />
                <Section label="Insight" content={analysis.insight} last />
              </div>
            )}
            {tab === "action" && (
              <div>
                <Section label="Recommended Action" content={analysis.recommended_action} last />
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

  const GoogleG = () => (
    <svg width="20" height="20" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg">
      <path d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z" fill="#4285f4"/>
      <path d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z" fill="#34a853"/>
      <path d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z" fill="#fbbc04"/>
      <path d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z" fill="#ea4335"/>
    </svg>
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-hi)",
      borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, background: "#fff",
          borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, border: "1px solid #e0e0e0" }}>
          <GoogleG />
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
            <GoogleG /> Connect Gmail
          </button>
          <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
            READ-ONLY ACCESS · EMAILS NEVER STORED · SIGNALS ONLY
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
function Dashboard({ user, onLogout, openSettings = false, slackChannel = "", gmailEmail = "", justConnected = "" }) {
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
        background: "rgba(6,15,31,0.8)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10 }}>
        <Logo size={44} />

        {/* Pipeline stats */}
        <div className="header-stats" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[
            { label: "Pipeline", value: `$${totalValue.toLocaleString()}`, color: "var(--blue-light)", glow: "rgba(125,211,252,0.4)" },
            { label: "Deals",    value: deals.length, color: "var(--text-2)", glow: null },
            { label: "At Risk",  value: atRisk, color: atRisk > 0 ? "var(--risk-high)" : "var(--text-3)", glow: atRisk > 0 ? "rgba(239,68,68,0.4)" : null },
          ].map(({ label, value, color, glow }) => (
            <div key={label} style={{ textAlign: "center", padding: "6px 16px",
              background: "rgba(255,255,255,0.03)", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700,
                color, textShadow: glow ? `0 0 16px ${glow}` : "none" }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)",
            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </div>
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
                Add your first deal to start getting AI intelligence.
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
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600,
                      color: "var(--text-1)", marginBottom: 2 }}>{deal.company}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{deal.contact_name}</div>
                  </div>
                  {rk && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                      padding: "2px 8px", borderRadius: 20,
                      background: RISK[rk].bg, color: RISK[rk].color,
                      border: `1px solid ${RISK[rk].border}`, letterSpacing: "0.06em",
                      flexShrink: 0 }}>
                      {rk.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 14,
                      fontWeight: 700, color: "var(--blue-light)" }}>
                      ${Number(deal.value || 0).toLocaleString()}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                      color: "var(--text-muted)", marginTop: 3 }}>
                      {deal.stage} · {deal.days_stale}d stale
                    </div>
                  </div>
                  {a
                    ? <ScoreRing score={a.close_score} size={60} />
                    : <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                        color: "var(--text-muted)", padding: "8px 0" }}>NO SCORE</div>
                  }
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
  const [oauthResult, setOauthResult] = useState(null); // {type, status, value}

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
    clearToken(); setUser(null);
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
  />;
}
