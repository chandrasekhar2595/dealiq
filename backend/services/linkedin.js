const NEWS_RSS = "https://news.google.com/rss/search";

async function fetchContactNews(contactName, company, maxItems = 10) {
  const query = encodeURIComponent(`"${contactName}" OR "${company}"`);
  const url = `${NEWS_RSS}?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DealIQ/1.0)" },
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  return items.slice(0, maxItems).map(item => {
    const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || "";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || "";
    const link    = (item.match(/<link>(.*?)<\/link>/))?.[1] || "";
    const source  = (item.match(/<source[^>]*>(.*?)<\/source>/))?.[1] || "";
    return { title, pubDate, link, source, publishedAt: pubDate ? new Date(pubDate).getTime() : null };
  }).filter(i => i.title);
}

function extractLinkedInSignals(newsItems, contactName, company) {
  if (!newsItems.length) return [];

  const signals = [];
  const now = Date.now();
  const contactLower  = contactName.toLowerCase();
  const companyLower  = company.toLowerCase();

  const JOB_CHANGE    = /joins|appointed|named|promoted|hired|new role|new cto|new ceo|new vp|leaves|departed|resigned|steps down/i;
  const FUNDING       = /raises|funding|series [a-e]|million|billion|investment|backed|venture|seed round|ipo/i;
  const GROWTH        = /expands|expansion|launches|new product|partnership|acquires|acquisition|merger/i;
  const RISK          = /layoffs|cuts|downsizing|bankrupt|struggling|losses|shutdown|closure/i;

  const recent = newsItems.filter(n => n.publishedAt && (now - n.publishedAt) < 90 * 86_400_000);

  for (const news of recent) {
    const t = news.title;
    const daysAgo = news.publishedAt ? Math.floor((now - news.publishedAt) / 86_400_000) : null;
    const when = daysAgo !== null ? (daysAgo === 0 ? "today" : `${daysAgo}d ago`) : "recently";

    if (JOB_CHANGE.test(t) && (t.toLowerCase().includes(contactLower) || t.toLowerCase().includes(companyLower))) {
      signals.push({ source: "linkedin", type: "job_change",
        summary: `Job change signal (${when}): "${t}"`,
        sentiment: t.toLowerCase().includes(contactLower) ? "negative" : "neutral" });
      continue;
    }
    if (FUNDING.test(t) && t.toLowerCase().includes(companyLower)) {
      signals.push({ source: "linkedin", type: "funding",
        summary: `Funding/growth news (${when}): "${t}"`,
        sentiment: "positive" });
      continue;
    }
    if (GROWTH.test(t) && t.toLowerCase().includes(companyLower)) {
      signals.push({ source: "linkedin", type: "company_growth",
        summary: `Company news (${when}): "${t}"`,
        sentiment: "positive" });
      continue;
    }
    if (RISK.test(t) && t.toLowerCase().includes(companyLower)) {
      signals.push({ source: "linkedin", type: "company_risk",
        summary: `Risk signal (${when}): "${t}"`,
        sentiment: "negative" });
    }
  }

  // Always add a news summary signal with the latest headlines
  if (recent.length > 0) {
    const headlines = recent.slice(0, 3).map(n => n.title).join(" · ");
    signals.push({ source: "linkedin", type: "news_context",
      summary: `Recent news: "${headlines}"`,
      sentiment: "neutral" });
  }

  return signals;
}

module.exports = { fetchContactNews, extractLinkedInSignals };
