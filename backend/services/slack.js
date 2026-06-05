const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://dealiq-frontend-omega.vercel.app";

const RISK_EMOJI  = { high: "🔴", medium: "🟡", low: "🟢" };
const RISK_COLOR  = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const URGENCY_LABEL = { immediate: "Act today", this_week: "This week", monitor: "Monitor" };

async function sendSlackAlert(webhookUrl, { deal, analysis, type = "analysis", topSignal = null, previousRiskLevel = null }) {
  if (!webhookUrl) return;

  const emoji  = RISK_EMOJI[analysis.risk_level]  || "⚡";
  const color  = RISK_COLOR[analysis.risk_level]  || "#f5a623";
  const urgency = URGENCY_LABEL[analysis.urgency] || analysis.urgency;

  const escalated = previousRiskLevel && previousRiskLevel !== analysis.risk_level
    && (analysis.risk_level === "high" || (analysis.risk_level === "medium" && previousRiskLevel === "low"));

  const header = type === "stale"
    ? `*${deal.company}* has gone stale — ${deal.days_stale} days with no activity`
    : escalated
    ? `⚠️ *${deal.company}* escalated ${previousRiskLevel?.toUpperCase()} → ${analysis.risk_level?.toUpperCase()} RISK`
    : `*${deal.company}* just analyzed — ${emoji} ${analysis.risk_level?.toUpperCase()} RISK`;

  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *DealIQ Alert*\n${header}`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Contact*\n${deal.contact_name}${deal.contact_role ? ` · ${deal.contact_role}` : ""}` },
          { type: "mrkdwn", text: `*Value*\n$${Number(deal.value || 0).toLocaleString()}` },
          { type: "mrkdwn", text: `*Stage*\n${deal.stage}` },
          { type: "mrkdwn", text: `*Close Score*\n${analysis.close_score}/100 · ${urgency}` },
        ],
      },
      ...(topSignal ? [{
        type: "section",
        text: { type: "mrkdwn", text: `*Top Signal*\n${topSignal}` },
      }] : []),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Why it's stalling*\n${analysis.stall_reason}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*What to do*\n${analysis.recommended_action}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in DealIQ →", emoji: true },
            url: `${APP_URL}`,
            style: "primary",
          },
        ],
      },
    ],
    attachments: [{ color }],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("Slack webhook failed:", res.status);
  } catch (err) {
    console.error("Slack send error:", err.message);
  }
}

module.exports = { sendSlackAlert };
