const TOKEN_URL  = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to refresh Gmail token");
  return data.access_token;
}

// Fetch emails related to a contact email address
async function fetchEmailsForContact(accessToken, contactEmail, maxResults = 20) {
  const query = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
  const url = `${GMAIL_BASE}/messages?q=${query}&maxResults=${maxResults}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.messages) return [];

  // Fetch details for each message
  const messages = await Promise.all(
    data.messages.slice(0, 10).map(m => fetchMessageDetail(accessToken, m.id))
  );
  return messages.filter(Boolean);
}

async function fetchMessageDetail(accessToken, messageId) {
  const res = await fetch(`${GMAIL_BASE}/messages/${messageId}?format=metadata&metadataHeaders=From,To,Subject,Date`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const msg = await res.json();
  if (!msg.payload) return null;

  const headers = msg.payload.headers || [];
  const get = (name) => headers.find(h => h.name === name)?.value || "";

  return {
    id:       msg.id,
    date:     get("Date"),
    from:     get("From"),
    to:       get("To"),
    subject:  get("Subject"),
    snippet:  msg.snippet || "",
    timestamp: msg.internalDate ? parseInt(msg.internalDate) : null,
  };
}

// Analyse emails and produce signals
function extractSignals(emails, contactEmail, dealDaysStale) {
  if (!emails.length) return [];

  const signals = [];
  const now     = Date.now();

  // Sort by timestamp newest first
  const sorted = [...emails].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const latest = sorted[0];

  // Days since last email
  const daysSinceLastEmail = latest?.timestamp
    ? Math.floor((now - latest.timestamp) / 86_400_000)
    : null;

  if (daysSinceLastEmail !== null) {
    if (daysSinceLastEmail > 14) {
      signals.push({ source: "gmail", type: "silence",
        summary: `No email activity with ${contactEmail} in ${daysSinceLastEmail} days`,
        sentiment: "negative" });
    } else if (daysSinceLastEmail > 7) {
      signals.push({ source: "gmail", type: "slow_cadence",
        summary: `Last email with contact was ${daysSinceLastEmail} days ago — cadence slowing`,
        sentiment: "negative" });
    } else if (daysSinceLastEmail === 0) {
      signals.push({ source: "gmail", type: "active",
        summary: `Recent email activity — contact engaged today`,
        sentiment: "positive" });
    } else if (daysSinceLastEmail <= 2) {
      signals.push({ source: "gmail", type: "active",
        summary: `Recent email activity — contact engaged ${daysSinceLastEmail} day${daysSinceLastEmail === 1 ? "" : "s"} ago`,
        sentiment: "positive" });
    }
  }

  // Reply pattern: check if last email was sent BY us (no reply from contact)
  const lastEmailFromContact = sorted.find(e =>
    e.from?.toLowerCase().includes(contactEmail.toLowerCase())
  );
  const lastEmailFromUs = sorted.find(e =>
    !e.from?.toLowerCase().includes(contactEmail.toLowerCase())
  );

  if (lastEmailFromUs && (!lastEmailFromContact ||
    (lastEmailFromContact.timestamp < lastEmailFromUs.timestamp))) {
    const daysSinceSent = lastEmailFromUs.timestamp
      ? Math.floor((now - lastEmailFromUs.timestamp) / 86_400_000)
      : null;
    if (daysSinceSent > 5) {
      signals.push({ source: "gmail", type: "no_reply",
        summary: `Sent email ${daysSinceSent} days ago — no reply from ${contactEmail} yet`,
        sentiment: "negative" });
    }
  }

  // Email volume
  if (emails.length >= 5) {
    signals.push({ source: "gmail", type: "engagement",
      summary: `${emails.length} email threads found with this contact — active correspondence`,
      sentiment: "positive" });
  } else if (emails.length <= 2) {
    signals.push({ source: "gmail", type: "low_engagement",
      summary: `Only ${emails.length} emails found with this contact — low email engagement`,
      sentiment: "neutral" });
  }

  // Recent subject lines for context
  const recentSubjects = sorted.slice(0, 3)
    .map(e => e.subject)
    .filter(Boolean)
    .join(" · ");
  if (recentSubjects) {
    signals.push({ source: "gmail", type: "context",
      summary: `Recent email subjects: "${recentSubjects}"`,
      sentiment: "neutral" });
  }

  return signals;
}

module.exports = { fetchEmailsForContact, extractSignals, refreshAccessToken };
