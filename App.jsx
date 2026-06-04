import { useState, useEffect, useCallback } from "react";

// ── CONFIG ───────────────────────────────────────────────────
const API = "http://localhost:4000/api";

// ── HELPERS ──────────────────────────────────────────────────
function getToken() { return localStorage.getItem("dealiq_token"); }
function setToken(t) { localStorage.setItem("dealiq_token", t); }
function clearToken() { localStorage.removeItem("dealiq_token"); }

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

const riskColor = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const riskBg = { high: "#ef444415", medium: "#f59e0b15", low: "#22c55e15" };

// ── SCORE RING ───────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 26, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="68" height="68" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x="34" y="34" textAnchor="middle" dominantBaseline="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: "34px 34px", fill: color, fontSize: "13px", fontWeight: "700", fontFamily: "monospace" }}>
        {score}
      </text>
    </svg>
  );
}

// ── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        await api("/auth/signup", { method: "POST", body: { ...form, name, company } });
        setMode("login");
        setError("Account created! Please sign in.");
      } else {
        const { token, user } = await api("/auth/login", { method: "POST", body: form });
        setToken(token);
        onLogin(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#040d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ width: 380, background: "#060f1f", border: "1px solid #0f2040", borderRadius: 12, padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#f1f5f9", letterSpacing: -1 }}>Deal<span style={{ color: "#f5a623" }}>IQ</span></div>
          <div style={{ fontSize: 10, color: "#334155", letterSpacing: 2, marginTop: 4 }}>AI DEAL INTELLIGENCE</div>
        </div>

        {error && (
          <div style={{ background: error.includes("created") ? "#22c55e15" : "#ef444415", border: `1px solid ${error.includes("created") ? "#22c55e" : "#ef4444"}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: error.includes("created") ? "#22c55e" : "#ef4444" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
                style={inputStyle} />
              <input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)}
                style={inputStyle} />
            </>
          )}
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            style={inputStyle} required />
          <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            style={inputStyle} required />
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", background: "#f5a623", border: "none", borderRadius: 8, color: "#040d1a", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1, marginTop: 8 }}>
            {loading ? "..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#334155" }}>
          {mode === "login" ? (
            <span>No account? <span onClick={() => setMode("signup")} style={{ color: "#f5a623", cursor: "pointer" }}>Sign up</span></span>
          ) : (
            <span>Have an account? <span onClick={() => setMode("login")} style={{ color: "#f5a623", cursor: "pointer" }}>Sign in</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 14px", background: "#040d1a", border: "1px solid #0f2040",
  borderRadius: 8, color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
  marginBottom: 12, boxSizing: "border-box", outline: "none",
};

// ── ADD DEAL MODAL ───────────────────────────────────────────
function AddDealModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ company: "", contact_name: "", contact_email: "", contact_role: "", value: "", stage: "Discovery", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { deal } = await api("/deals", { method: "POST", body: { ...form, value: Number(form.value) || 0 } });
      onAdd(deal);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ width: 480, background: "#060f1f", border: "1px solid #0f2040", borderRadius: 12, padding: 32, fontFamily: "'IBM Plex Mono', monospace" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Add new deal</div>
          <div onClick={onClose} style={{ color: "#334155", cursor: "pointer", fontSize: 18 }}>✕</div>
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {[
            { key: "company", label: "Company *" },
            { key: "contact_name", label: "Contact name *" },
            { key: "contact_email", label: "Contact email *" },
            { key: "contact_role", label: "Contact role" },
            { key: "value", label: "Deal value ($)" },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#334155", letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</div>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 0 }} required={label.includes("*")} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: 1, marginBottom: 4 }}>STAGE</div>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 0 }}>
              {["Discovery", "Proposal Sent", "Negotiation", "Closing", "Won", "Lost"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: 1, marginBottom: 4 }}>NOTES</div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} style={{ ...inputStyle, marginBottom: 0, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: 12, background: "none", border: "1px solid #0f2040", borderRadius: 8, color: "#475569", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              CANCEL
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: 12, background: "#f5a623", border: "none", borderRadius: 8, color: "#040d1a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              {loading ? "ADDING..." : "ADD DEAL"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DEAL DETAIL PANEL ────────────────────────────────────────
function DealDetail({ dealId, onBack }) {
  const [deal, setDeal] = useState(null);
  const [signals, setSignals] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [tab, setTab] = useState("insights");
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/deals/${dealId}`).then(({ deal, signals, latest_analysis }) => {
      setDeal(deal);
      setSignals(signals);
      setAnalysis(latest_analysis);
    });
  }, [dealId]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const { analysis: a } = await api(`/deals/${dealId}/analyze`, { method: "POST" });
      setAnalysis(a);
      setTab("insights");
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (!deal) return <div style={{ padding: 40, color: "#334155", fontFamily: "monospace" }}>Loading...</div>;

  const sentIcons = { positive: { icon: "↑", color: "#22c55e" }, negative: { icon: "↓", color: "#ef4444" }, neutral: { icon: "→", color: "#7dd3fc" } };

  return (
    <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto", fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #0f2040", color: "#475569", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>← BACK</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{deal.company}</div>
        {analysis && (
          <div style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: riskBg[analysis.risk_level], color: riskColor[analysis.risk_level], border: `1px solid ${riskColor[analysis.risk_level]}40`, letterSpacing: 1 }}>
            {analysis.risk_level?.toUpperCase()} RISK
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#475569", marginBottom: 24 }}>
        {deal.contact_name} · {deal.contact_role} · {deal.stage} · <span style={{ color: "#7dd3fc" }}>${Number(deal.value || 0).toLocaleString()}</span>
      </div>

      {signals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#334155", marginBottom: 10 }}>SIGNALS ({signals.length})</div>
          {signals.slice(0, 5).map((sig, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#060f1f", border: "1px solid #0f2040", marginBottom: 6 }}>
              <div style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "#0a1f38", color: "#7dd3fc", flexShrink: 0, letterSpacing: 1 }}>{sig.source?.toUpperCase()}</div>
              <div style={{ flex: 1, fontSize: 11, color: "#94a3b8" }}>{sig.summary}</div>
              <div style={{ fontSize: 14, color: sentIcons[sig.sentiment || "neutral"]?.color, fontWeight: 700 }}>{sentIcons[sig.sentiment || "neutral"]?.icon}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #0f2040", flex: 1 }}>
          {["insights", "action", "draft"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 9, letterSpacing: 2, color: tab === t ? "#7dd3fc" : "#334155", borderBottom: tab === t ? "2px solid #0ea5e9" : "2px solid transparent", textTransform: "uppercase", fontFamily: "inherit" }}>
              {t === "insights" ? "AI INSIGHTS" : t === "action" ? "NEXT ACTION" : "DRAFT EMAIL"}
            </button>
          ))}
        </div>
        <button onClick={runAnalysis} disabled={analyzing}
          style={{ marginLeft: 12, padding: "6px 14px", background: analyzing ? "#0a1f38" : "#f5a623", border: "none", borderRadius: 6, color: analyzing ? "#334155" : "#040d1a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 1, flexShrink: 0 }}>
          {analyzing ? "ANALYZING..." : "⚡ ANALYZE"}
        </button>
      </div>

      <div style={{ background: "#060f1f", border: "1px solid #0f2040", borderRadius: 10, padding: 20, minHeight: 160, fontSize: 12, lineHeight: 1.8, color: "#94a3b8" }}>
        {!analysis && !analyzing && (
          <div style={{ color: "#1e3a5f", textAlign: "center", paddingTop: 40 }}>Click ⚡ ANALYZE to get AI intelligence on this deal</div>
        )}
        {analyzing && <div style={{ color: "#334155" }}>⟳ Analyzing signals with Claude AI...</div>}
        {analysis && !analyzing && tab === "insights" && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#0ea5e9", marginBottom: 6 }}>STALL REASON</div>
              <div>{analysis.stall_reason}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#0ea5e9", marginBottom: 6 }}>INSIGHT</div>
              <div>{analysis.insight}</div>
            </div>
          </div>
        )}
        {analysis && !analyzing && tab === "action" && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#0ea5e9", marginBottom: 10 }}>RECOMMENDED ACTION</div>
            <div>{analysis.recommended_action}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <div style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: riskBg[analysis.risk_level], color: riskColor[analysis.risk_level], border: `1px solid ${riskColor[analysis.risk_level]}40` }}>
                {analysis.urgency?.replace("_", " ").toUpperCase()}
              </div>
              <div style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: "#0a1f38", color: "#7dd3fc", border: "1px solid #1e3a5f" }}>
                SCORE: {analysis.close_score}/100
              </div>
            </div>
          </div>
        )}
        {analysis && !analyzing && tab === "draft" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: "#0ea5e9", marginBottom: 4 }}>SUBJECT</div>
                <div style={{ fontSize: 12, color: "#f1f5f9" }}>{analysis.draft_email_subject}</div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`Subject: ${analysis.draft_email_subject}\n\n${analysis.draft_email_body}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ background: copied ? "#22c55e20" : "#0a1f38", border: `1px solid ${copied ? "#22c55e" : "#1e3a5f"}`, color: copied ? "#22c55e" : "#475569", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 9, letterSpacing: 1, fontFamily: "inherit" }}>
                {copied ? "COPIED ✓" : "COPY"}
              </button>
            </div>
            <div style={{ borderTop: "1px solid #0f2040", paddingTop: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#0ea5e9", marginBottom: 8 }}>BODY</div>
              <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.9 }}>
                {analysis.draft_email_body}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ───────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [deals, setDeals] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDeals = useCallback(async () => {
    try {
      const { deals } = await api("/deals");
      setDeals(deals);
    } catch (err) {
      if (err.message.includes("Authentication")) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const sortedDeals = [...deals].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    const aRisk = a.latest_analysis?.risk_level || "low";
    const bRisk = b.latest_analysis?.risk_level || "low";
    return (order[aRisk] ?? 3) - (order[bRisk] ?? 3);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#040d1a", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column" }}>
      <div style={{ borderBottom: "1px solid #0f2040", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#060f1f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9", letterSpacing: -1 }}>Deal<span style={{ color: "#f5a623" }}>IQ</span></div>
          <div style={{ fontSize: 9, color: "#334155", letterSpacing: 2 }}>AI DEAL INTELLIGENCE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 11, color: "#334155" }}>{user?.email}</div>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid #0f2040", color: "#475569", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 1 }}>SIGN OUT</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 320, borderRight: "1px solid #0f2040", overflowY: "auto", padding: "16px 0", flexShrink: 0 }}>
          <div style={{ padding: "0 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#334155" }}>{deals.length} ACTIVE DEALS</div>
            <button onClick={() => setShowAddDeal(true)}
              style={{ background: "#f5a623", border: "none", color: "#040d1a", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
              + ADD
            </button>
          </div>

          {loading && <div style={{ padding: "20px", color: "#334155", fontSize: 11 }}>Loading deals...</div>}

          {!loading && deals.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#1e3a5f", fontSize: 11 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              No deals yet. Add your first deal to get started.
            </div>
          )}

          {sortedDeals.map(deal => {
            const a = deal.latest_analysis;
            return (
              <div key={deal.id} onClick={() => setSelectedId(deal.id)}
                style={{ margin: "0 10px 8px", padding: 16, borderRadius: 10, border: selectedId === deal.id ? "1px solid #0ea5e9" : "1px solid #0f2040", background: selectedId === deal.id ? "#0a1f38" : "#060f1f", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{deal.company}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{deal.contact_name}</div>
                  </div>
                  {a && (
                    <div style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: riskBg[a.risk_level], color: riskColor[a.risk_level], border: `1px solid ${riskColor[a.risk_level]}30`, letterSpacing: 1 }}>
                      {a.risk_level?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7dd3fc" }}>${Number(deal.value || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>{deal.stage} · {deal.days_stale}d stale</div>
                  </div>
                  {a ? <ScoreRing score={a.close_score} /> : (
                    <div style={{ width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#1e3a5f" }}>NO SCORE</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedId ? (
          <DealDetail dealId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#1e3a5f" }}>
            <div style={{ fontSize: 48 }}>⚡</div>
            <div style={{ fontSize: 11, letterSpacing: 2 }}>SELECT A DEAL TO ANALYZE</div>
          </div>
        )}
      </div>

      {showAddDeal && (
        <AddDealModal
          onClose={() => setShowAddDeal(false)}
          onAdd={(deal) => { setDeals(d => [deal, ...d]); setSelectedId(deal.id); }}
        />
      )}
    </div>
  );
}

// ── ROOT APP ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
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
    clearToken();
    setUser(null);
  }

  if (checking) return (
    <div style={{ minHeight: "100vh", background: "#040d1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontFamily: "monospace" }}>
      Loading...
    </div>
  );

  if (!user) return <LoginPage onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
