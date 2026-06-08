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
  "forecast_confidence": "high" | "medium" | "low",
  "supporting_signals": ["<3-5 word phrase explaining why>", "<phrase 2>", "<phrase 3>"],
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
- NO emojis, bullet points, dashes, markdown, or parentheses in any text field. Plain prose only.
- recommended_action: ONE sentence, max 15 words, starts with a verb. Example: "Call Sarah this week and reference her board nomination directly."
- stall_reason: 1-2 sentences max. No em dashes.
- insight: 2-3 sentences max. No em dashes.
- supporting_signals: 2-4 short phrases (3-6 words each) that explain WHY the score is what it is. Examples: "champion engaged this week", "pricing discussed", "no response 20 days", "procurement not started". Be specific to THIS deal.
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
Lead Source: ${deal.lead_source || "Unknown"}
Expected Close: ${deal.close_timeline?.replace(/_/g, " ") || "Unknown"}
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

async function generateMeetingPrep(deal, signals, analysis) {
  const signalText = signals.map(s => `- [${s.source.toUpperCase()}] ${s.summary}`).join("\n") || "No signals yet.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You are a senior B2B sales coach preparing a rep for a call. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `Prepare a pre-call brief for this deal:

Company: ${deal.company}
Contact: ${deal.contact_name} (${deal.contact_role || "Unknown role"})
Value: $${Number(deal.value || 0).toLocaleString()}
Stage: ${deal.stage}
Days stale: ${deal.days_stale}
Notes: ${deal.notes || "None"}
Risk: ${analysis?.risk_level || "unknown"} | Score: ${analysis?.close_score || "N/A"}

Signals:
${signalText}

Return JSON:
{
  "situation": "<2 sentence deal situation summary>",
  "contact_profile": "<what we know about this person and their likely priorities>",
  "goal": "<what to achieve in this call>",
  "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
  "questions_to_ask": ["<question 1>", "<question 2>", "<question 3>"],
  "risks_to_address": ["<risk 1>", "<risk 2>"],
  "one_line_opener": "<a natural, non-salesy opening line for the call>"
}`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function handleObjection(deal, signals, objection) {
  const signalText = signals.map(s => `- [${s.source.toUpperCase()}] ${s.summary}`).join("\n") || "No signals.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `You are an expert B2B sales coach. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `A sales rep is facing this objection on a deal. Help them handle it.

Deal: ${deal.company} | ${deal.contact_name} | $${Number(deal.value || 0).toLocaleString()} | ${deal.stage}
Objection: "${objection}"

Signals:
${signalText}

Return JSON:
{
  "objection_type": "<budget | timing | competition | authority | need | other>",
  "what_it_really_means": "<what the prospect is actually saying underneath>",
  "response_strategy": "<2-3 sentence approach>",
  "word_for_word": "<exact words to say in response>",
  "follow_up_question": "<a question to ask after your response to move forward>"
}`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function suggestStageUpdate(deal, signals) {
  const signalText = signals.map(s => `- [${s.source.toUpperCase()}] ${s.summary}`).join("\n") || "No signals.";
  const stages = ["Discovery", "Proposal Sent", "Negotiation", "Closing", "Stalled"];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: `You are a CRM automation engine. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `Based on these signals, should this deal's stage be updated?

Current stage: ${deal.stage}
Days stale: ${deal.days_stale}
Notes: ${deal.notes || "None"}

Signals:
${signalText}

Valid stages: ${stages.join(", ")}

Return JSON:
{
  "should_update": true | false,
  "suggested_stage": "<stage name or null>",
  "reason": "<one sentence why>"
}`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function generateContactInsights(deal, signals, analyses, events) {
  const signalText = signals.map(s => `[${s.source}] ${s.summary} (${s.sentiment})`).join("\n") || "No signals.";
  const latestAnalysis = analyses?.[0];
  const eventText = events?.slice(0, 8).map(e => `${e.event_type}: ${e.description}`).join("\n") || "No events.";

  // Compute basic metrics from signals
  const emailSignals = signals.filter(s => s.source === "gmail");
  const positiveSignals = signals.filter(s => s.sentiment === "positive").length;
  const negativeSignals = signals.filter(s => s.sentiment === "negative").length;
  const totalSignals = signals.length || 1;
  const engagementScore = Math.round((positiveSignals / totalSignals) * 100);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You are an elite B2B sales intelligence analyst. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `Generate a comprehensive contact intelligence profile for this B2B sales contact.

Contact: ${deal.contact_name} (${deal.contact_role || "Unknown role"})
Company: ${deal.company}
Deal: $${Number(deal.value || 0).toLocaleString()} | ${deal.stage} | ${deal.days_stale}d stale
Current Risk: ${latestAnalysis?.risk_level || "unanalyzed"} | Score: ${latestAnalysis?.close_score || "N/A"}

Signals (${signals.length} total):
${signalText}

Recent Events:
${eventText}

Return JSON:
{
  "executive_summary": "<3-4 sentence executive summary of this contact's status, priorities, and deal impact>",
  "engagement_trend": "growing" | "stable" | "declining",
  "relationship_score": <0-100 integer based on engagement and response patterns>,
  "influence_score": <0-100 integer based on role seniority and deal involvement>,
  "decision_power": "high" | "medium" | "low",
  "communication_style": "<2-4 words: e.g. Direct and concise>",
  "decision_style": "<2-4 words: e.g. Consensus driven>",
  "risk_tolerance": "high" | "medium" | "low",
  "buying_style": "<2-4 words: e.g. Data-focused>",
  "preferred_channel": "email" | "phone" | "linkedin" | "in-person",
  "recommended_actions": [
    {
      "action": "<specific action to take>",
      "impact": "<expected outcome e.g. +15% close probability>",
      "confidence": <0-100>,
      "reasoning": "<1 sentence why>"
    }
  ],
  "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "confidence": <0-100 overall AI confidence>
}`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const insights = JSON.parse(raw.replace(/```json|```/g, "").trim());

  // Attach computed metrics
  insights.email_count = emailSignals.length;
  insights.positive_signals = positiveSignals;
  insights.negative_signals = negativeSignals;
  insights.engagement_score = engagementScore;

  return insights;
}

module.exports = { analyzeDeal, generateMeetingPrep, handleObjection, suggestStageUpdate, generateContactInsights };
