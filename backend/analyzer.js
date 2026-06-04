// backend/services/analyzer.js
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `
You are DealIQ, an expert B2B sales intelligence agent with deep knowledge of enterprise sales psychology.

Analyze signals from a B2B sales deal and return structured JSON intelligence.

## Signal Interpretation Framework

Email signals:
- No reply after proposal = evaluating alternatives
- Short replies = low engagement or internal blockers
- Fast replies with questions = strong buying intent
- Slowing reply cadence = champion losing internal support

Timing signals:
- 0-3 days stale: normal
- 4-7 days stale: soft nudge appropriate
- 8-14 days stale: deal at risk
- 15+ days stale: high risk

Engagement signals:
- Multiple stakeholders = deal moving internally
- Single contact only = single-threaded, dangerous
- Champion going quiet after strong engagement = internal obstacle

## Output Format — JSON only, no markdown, no preamble

{
  "risk_level": "high" | "medium" | "low",
  "close_score": <integer 0-100>,
  "stall_reason": "<1-2 sentence specific diagnosis>",
  "insight": "<2-3 sentence deeper analysis>",
  "recommended_action": "<1-2 sentences, be specific>",
  "urgency": "immediate" | "this_week" | "monitor",
  "draft_email": {
    "subject": "<subject line>",
    "body": "<full email body — conversational, value-add, not salesy>"
  }
}

Rules:
- Never be generic. Every field must be specific to this deal.
- Draft email must NOT sound like a follow-up template.
- Weight negative signals more heavily — deals die quietly.
`;

async function analyzeDeal(deal, signals) {
  const signalText = signals.length > 0
    ? signals.map((s, i) => `${i + 1}. [${s.source.toUpperCase()}] ${s.summary}`).join("\n")
    : "No signals detected — deal has had no recent activity.";

  const userMessage = `
Analyze this B2B sales deal:

Company: ${deal.company}
Contact: ${deal.contact_name} (${deal.contact_role || "Unknown role"})
Value: $${Number(deal.value || 0).toLocaleString()}
Stage: ${deal.stage}
Days stale: ${deal.days_stale}
Notes: ${deal.notes || "None"}

Signals (${signals.length} total):
${signalText}

Return JSON only.
`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { analyzeDeal };
