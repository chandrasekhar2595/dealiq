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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "20px 16px", position: "relative", overflow: "hidden" }}>

      {/* Background glow blobs — more visible */}
      <div style={{ position: "fixed", top: "-20%", right: "-10%", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 65%)",
        pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-20%", left: "-10%", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 65%)",
        pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>

        {/* Logo — dark pill treatment so it blends with the page */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(145deg, #0d1f35, #060f1f)",
            border: "1px solid rgba(245,166,35,0.25)",
            borderRadius: 24, padding: 6, marginBottom: 20,
            boxShadow: "0 0 0 1px rgba(245,166,35,0.08), 0 16px 48px rgba(0,0,0,0.5), 0 0 80px rgba(245,166,35,0.08)" }}>
            <img src="/logo.png" alt="DealIQ"
              style={{ height: 110, borderRadius: 18,
                mixBlendMode: "multiply", display: "block" }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)",
            letterSpacing: -0.3, marginBottom: 8 }}>
            Find the dying deal.{" "}
            <span style={{ background: "linear-gradient(135deg, #f5a623, #ff6b35)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text" }}>Close it.</span>
          </div>
          <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 20 }}>
            AI-powered deal intelligence for B2B sales teams.
          </div>

          {/* Feature pills — visible badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Signal Detection", color: "#7dd3fc", bg: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.2)" },
              { label: "Risk Scoring",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
              { label: "AI Follow-ups",   color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
            ].map(({ label, color, bg, border }) => (
              <div key={label} style={{ fontSize: 11, fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em", padding: "4px 12px", borderRadius: 20,
                background: bg, border: `1px solid ${border}`, color }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Card — visible glass with gradient top border */}
        <div style={{ position: "relative", borderRadius: 18, padding: 2,
          background: "linear-gradient(160deg, rgba(245,166,35,0.2), rgba(14,165,233,0.1) 50%, rgba(255,255,255,0.04))" }}>
          <div style={{
            background: "rgba(6,15,31,0.92)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            borderRadius: 16, padding: "32px 36px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em",
              color: "var(--text-3)", marginBottom: 22, textTransform: "uppercase" }}>
              {mode === "login" ? "→ Sign in to your workspace" : "→ Create your account"}
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

            <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-3)" }}>
              {mode === "login"
                ? <>No account?{" "}<span onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                    style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Sign up free →</span></>
                : <>Have an account?{" "}<span onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                    style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Sign in →</span></>
              }
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11,
          color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
          256-bit encryption · Data never shared · SOC 2 in progress
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
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 28, display: "flex", gap: 6 }}>
        <span>{deal.contact_name}</span>
        {deal.contact_role && <><span>·</span><span>{deal.contact_role}</span></>}
        <span>·</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--blue-light)", fontWeight: 600 }}>
          ${Number(deal.value || 0).toLocaleString()}
        </span>
        <span>·</span>
        <span style={{ fontFamily: "var(--font-mono)", color: deal.days_stale > 7 ? "var(--risk-high)" : "var(--text-3)" }}>
          {deal.days_stale}d stale
        </span>
      </div>

      {/* Score hero */}
      {analysis && (
        <div className="score-hero" style={{ display: "flex", gap: 24,
          background: "rgba(6,15,31,0.8)", backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "22px 28px", marginBottom: 24, alignItems: "center",
          boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 0 40px ${r?.glow || "transparent"}18` }}>
          <ScoreRing score={analysis.close_score} size={96} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--text-3)", letterSpacing: "0.15em", marginBottom: 6 }}>
              CLOSE PROBABILITY
            </div>
            <div style={{ fontSize: 18, fontWeight: 700,
              color: analysis.close_score >= 70 ? "var(--risk-low)" :
                     analysis.close_score >= 50 ? "var(--risk-med)" : "var(--risk-high)",
              marginBottom: 12,
              textShadow: `0 0 20px ${r?.glow || "transparent"}` }}>
              {analysis.close_score >= 70 ? "Strong position" :
               analysis.close_score >= 50 ? "Needs attention" : "At risk of stalling"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px",
                borderRadius: 20, background: r?.bg, color: r?.color,
                border: `1px solid ${r?.border}`,
                boxShadow: `0 0 12px ${r?.glow}` }}>
                {(analysis.urgency || "").replace("_", " ").toUpperCase()}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px",
                borderRadius: 20, background: "rgba(14,165,233,0.08)",
                color: "var(--blue-light)", border: "1px solid rgba(14,165,233,0.2)" }}>
                {signals.length} SIGNALS
              </span>
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
        <button onClick={runAnalysis} disabled={analyzing} className="btn-analyze"
          style={{ marginLeft: 12 }}>
          {analyzing
            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" /><span className="dot" /><span className="dot" />
              </span>
            : "⚡ Analyze"}
        </button>
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
                <Section label="Insight" content={analysis.insight} />
              </div>
            )}
            {tab === "action" && (
              <div>
                <Section label="Recommended Action" content={analysis.recommended_action} />
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

function Section({ label, content }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
        color: "var(--blue)", marginBottom: 8, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: "var(--text-2)" }}>{content}</div>
    </div>
  );
}

// ── MAIN DASHBOARD ───────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [deals, setDeals]           = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="DealIQ"
            style={{ height: 36, borderRadius: 8,
              boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }} />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8,
            letterSpacing: "0.2em", background: "rgba(14,165,233,0.08)",
            border: "1px solid rgba(14,165,233,0.15)", padding: "2px 8px",
            borderRadius: 20, color: "var(--blue-light)" }}>
            AI
          </div>
        </div>

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

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>{user?.email}</div>
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
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    api("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => clearToken())
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
  return <Dashboard user={user} onLogout={handleLogout} />;
}
