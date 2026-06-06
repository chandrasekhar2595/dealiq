const Anthropic = require("@anthropic-ai/sdk");
const NEWS_RSS = "https://news.google.com/rss/search";

const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchCompetitorNews(competitorName, maxItems = 8) {
  const query = encodeURIComponent(`"${competitorName}" product OR pricing OR launch OR feature OR sales`);
  const url = `${NEWS_RSS}?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DealIQ/1.0)" },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    return items.slice(0, maxItems).map(item => {
      const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || "";
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || "";
      const source  = (item.match(/<source[^>]*>(.*?)<\/source>/))?.[1] || "";
      return { title, pubDate, source, publishedAt: pubDate ? new Date(pubDate).getTime() : null };
    }).filter(i => i.title);
  } catch (e) {
    return [];
  }
}

async function analyzeCompetitor(deal, competitorName, newsItems) {
  const now = Date.now();
  const recentNews = newsItems
    .filter(n => n.publishedAt && (now - n.publishedAt) < 90 * 86_400_000)
    .slice(0, 5)
    .map(n => `- ${n.title} (${n.source || "news"})`)
    .join("\n") || "No recent news found.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are a B2B sales intelligence analyst. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `Analyze this competitor for a B2B sales deal.

Deal: ${deal.company} | ${deal.contact_name} (${deal.contact_role || "unknown role"}) | $${Number(deal.value||0).toLocaleString()} | ${deal.stage}
Competitor: ${competitorName}

Recent news about ${competitorName}:
${recentNews}

Return JSON:
{
  "threat_level": "high" | "medium" | "low",
  "threat_reason": "<one sentence why this competitor is or isn't a threat for this specific deal>",
  "recent_moves": ["<move 1>", "<move 2>"],
  "likely_objection": "<the exact objection the buyer might raise comparing to this competitor>",
  "counter_message": "<2-3 sentence response the rep should use to counter this competitor>",
  "win_angle": "<what DealIQ has that this competitor doesn't for this specific buyer>"
}`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function detectCompetitors(deal, signals) {
  if (!signals.length) return [];

  const signalText = signals
    .map(s => `- [${s.source?.toUpperCase()}] ${s.summary}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are a B2B sales intelligence analyst. Return JSON only, no markdown.`,
    messages: [{
      role: "user",
      content: `Analyze these signals from a B2B sales deal and detect any competitor products or companies the prospect might be evaluating.

Deal: ${deal.company} | ${deal.contact_name} | ${deal.stage} | $${Number(deal.value||0).toLocaleString()}

Signals:
${signalText}

Look for:
- Competitor names mentioned directly in emails
- References to "evaluating other options", "comparing solutions", "other vendors"
- Industry-specific competitors (CRM, sales tools, etc.)
- Any hint the prospect is in multiple vendor conversations

Return JSON:
{
  "detected": [
    {
      "name": "<competitor name>",
      "source": "<which signal revealed this>",
      "confidence": "high" | "medium" | "low",
      "evidence": "<quote or paraphrase from the signal that indicates this>"
    }
  ]
}

If no competitors are detectable, return { "detected": [] }.`
    }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
  return result.detected || [];
}

module.exports = { fetchCompetitorNews, analyzeCompetitor, detectCompetitors };
