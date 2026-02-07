/**
 * AI Bounty Board Email Digest Service
 *
 * Sends daily or weekly email digests of new bounties matching
 * subscriber preferences. Uses the Resend API for email delivery.
 *
 * Run: bun run index.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

// --- Configuration ---
const API_BASE = process.env.API_BASE_URL || "https://bounty.owockibot.xyz";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "bounties@yourdomain.com";
const PORT = Number(process.env.PORT) || 3300;
const SUBSCRIBERS_FILE = process.env.SUBSCRIBERS_FILE || "./subscribers.json";
const STATE_FILE = process.env.STATE_FILE || "./digest-state.json";
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL_MS) || 60_000 * 60; // 1 hour

// --- Types ---
interface Subscriber {
  id: string;
  email: string;
  tags: string[];
  frequency: "daily" | "weekly";
  active: boolean;
  createdAt: string;
  lastDigestSent: string | null;
}

interface Bounty {
  id: number;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  tags: string[];
  createdAt: string;
  expiresAt: string | null;
}

interface DigestState {
  lastKnownBountyIds: number[];
  lastDailyRun: string | null;
  lastWeeklyRun: string | null;
}

// --- State ---
let subscribers: Subscriber[] = [];
let digestState: DigestState = {
  lastKnownBountyIds: [],
  lastDailyRun: null,
  lastWeeklyRun: null,
};

// --- Persistence ---
function loadSubscribers(): void {
  if (existsSync(SUBSCRIBERS_FILE)) {
    try {
      subscribers = JSON.parse(readFileSync(SUBSCRIBERS_FILE, "utf-8"));
    } catch {
      subscribers = [];
    }
  }
}

function saveSubscribers(): void {
  writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
}

function loadState(): void {
  if (existsSync(STATE_FILE)) {
    try {
      digestState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {
      digestState = { lastKnownBountyIds: [], lastDailyRun: null, lastWeeklyRun: null };
    }
  }
}

function saveState(): void {
  writeFileSync(STATE_FILE, JSON.stringify(digestState, null, 2));
}

// --- Bounty Fetching ---
async function fetchOpenBounties(): Promise<Bounty[]> {
  try {
    const res = await fetch(`${API_BASE}/bounties`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const all = (await res.json()) as Bounty[];
    return all.filter((b) => b.status === "open");
  } catch (err) {
    console.error("Failed to fetch bounties:", err);
    return [];
  }
}

function findNewBounties(bounties: Bounty[]): Bounty[] {
  const knownIds = new Set(digestState.lastKnownBountyIds);
  return bounties.filter((b) => !knownIds.has(b.id));
}

function filterByTags(bounties: Bounty[], subscriberTags: string[]): Bounty[] {
  if (subscriberTags.length === 0) return bounties; // No tag filter = all bounties
  return bounties.filter((b) =>
    b.tags.some((t) => subscriberTags.includes(t.toLowerCase()))
  );
}

// --- Email Rendering ---
function renderDigestHtml(bounties: Bounty[], subscriberEmail: string): string {
  const bountyRows = bounties
    .map(
      (b) => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #e1e4e8;">
        <div style="font-weight: 600; font-size: 16px; color: #24292f; margin-bottom: 4px;">
          #${b.id}: ${escapeHtml(b.title)}
        </div>
        <div style="color: #57606a; font-size: 14px; margin-bottom: 8px;">
          ${escapeHtml(b.description.slice(0, 200))}${b.description.length > 200 ? "..." : ""}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="background: #dafbe1; color: #116329; padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: 600;">
            ${b.amount} ${b.currency}
          </span>
          ${b.tags
            .map(
              (t) =>
                `<span style="background: #ddf4ff; color: #0969da; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${escapeHtml(t)}</span>`
            )
            .join(" ")}
        </div>
      </td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f8fa; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background: #ffffff; border: 1px solid #d0d7de; border-radius: 12px; overflow: hidden;">
      <div style="background: #24292f; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">AI Bounty Board Digest</h1>
        <p style="color: #8b949e; margin: 8px 0 0 0; font-size: 14px;">
          ${bounties.length} new ${bounties.length === 1 ? "bounty" : "bounties"} matching your interests
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${bountyRows}
      </table>
      ${
        bounties.length === 0
          ? '<div style="padding: 32px; text-align: center; color: #57606a;">No new bounties matching your tags this period.</div>'
          : ""
      }
      <div style="padding: 16px; text-align: center; border-top: 1px solid #e1e4e8;">
        <a href="https://aibountyboard.com" style="color: #0969da; text-decoration: none; font-size: 14px;">
          View all bounties on AI Bounty Board
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 16px; color: #8b949e; font-size: 12px;">
      You're receiving this because you subscribed with ${escapeHtml(subscriberEmail)}.<br>
      To unsubscribe, send a DELETE request to the digest service API.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Email Sending (Resend API) ---
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[DRY RUN] Would send email to ${to}: ${subject}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Resend API error for ${to}: ${res.status} ${err}`);
      return false;
    }

    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
    return false;
  }
}

// --- Digest Logic ---
function shouldSendDigest(sub: Subscriber, frequency: "daily" | "weekly"): boolean {
  if (sub.frequency !== frequency || !sub.active) return false;

  if (!sub.lastDigestSent) return true;

  const lastSent = new Date(sub.lastDigestSent).getTime();
  const now = Date.now();

  if (frequency === "daily") {
    return now - lastSent >= 23 * 60 * 60 * 1000; // ~23 hours
  }
  return now - lastSent >= 6.5 * 24 * 60 * 60 * 1000; // ~6.5 days
}

async function runDigests(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();

  // Only send digests between 8-9 AM
  if (hour < 8 || hour >= 9) return;

  const bounties = await fetchOpenBounties();
  const newBounties = findNewBounties(bounties);

  // Process daily digests
  const dailySubs = subscribers.filter((s) => shouldSendDigest(s, "daily"));
  for (const sub of dailySubs) {
    const matched = filterByTags(newBounties.length > 0 ? newBounties : bounties, sub.tags);
    const subject = newBounties.length > 0
      ? `${matched.length} New Bounties on AI Bounty Board`
      : "Your AI Bounty Board Digest";
    const html = renderDigestHtml(matched, sub.email);
    const sent = await sendEmail(sub.email, subject, html);
    if (sent) {
      sub.lastDigestSent = now.toISOString();
    }
  }

  // Process weekly digests (only on Mondays)
  if (now.getDay() === 1) {
    const weeklySubs = subscribers.filter((s) => shouldSendDigest(s, "weekly"));
    for (const sub of weeklySubs) {
      const matched = filterByTags(bounties, sub.tags);
      const subject = `Weekly Digest: ${matched.length} Open Bounties`;
      const html = renderDigestHtml(matched, sub.email);
      const sent = await sendEmail(sub.email, subject, html);
      if (sent) {
        sub.lastDigestSent = now.toISOString();
      }
    }
  }

  // Update known bounties
  digestState.lastKnownBountyIds = bounties.map((b) => b.id);
  digestState.lastDailyRun = now.toISOString();
  if (now.getDay() === 1) {
    digestState.lastWeeklyRun = now.toISOString();
  }

  saveSubscribers();
  saveState();
}

// --- Helper ---
function generateId(): string {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- HTTP Server ---
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    // List subscribers
    if (method === "GET" && url.pathname === "/subscribers") {
      return Response.json(
        subscribers.map((s) => ({ ...s, email: maskEmail(s.email) }))
      );
    }

    // Subscribe
    if (method === "POST" && url.pathname === "/subscribers") {
      try {
        const body = await req.json();
        const { email, tags, frequency } = body as {
          email: string;
          tags?: string[];
          frequency?: "daily" | "weekly";
        };

        if (!email || !isValidEmail(email)) {
          return Response.json({ error: "Valid email is required" }, { status: 400 });
        }

        // Check for duplicate
        if (subscribers.find((s) => s.email === email)) {
          return Response.json({ error: "Email already subscribed" }, { status: 409 });
        }

        const sub: Subscriber = {
          id: generateId(),
          email,
          tags: (tags || []).map((t) => t.toLowerCase()),
          frequency: frequency || "daily",
          active: true,
          createdAt: new Date().toISOString(),
          lastDigestSent: null,
        };

        subscribers.push(sub);
        saveSubscribers();

        return Response.json(
          { id: sub.id, email: maskEmail(sub.email), tags: sub.tags, frequency: sub.frequency },
          { status: 201 }
        );
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    // Update subscription
    if (method === "PATCH" && url.pathname.startsWith("/subscribers/")) {
      const id = url.pathname.split("/")[2];
      const idx = subscribers.findIndex((s) => s.id === id);
      if (idx < 0) return Response.json({ error: "Not found" }, { status: 404 });

      try {
        const body = await req.json();
        const updates = body as Partial<Pick<Subscriber, "tags" | "frequency" | "active">>;

        if (updates.tags) subscribers[idx].tags = updates.tags.map((t) => t.toLowerCase());
        if (updates.frequency) subscribers[idx].frequency = updates.frequency;
        if (updates.active !== undefined) subscribers[idx].active = updates.active;

        saveSubscribers();
        return Response.json({ ...subscribers[idx], email: maskEmail(subscribers[idx].email) });
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    // Unsubscribe
    if (method === "DELETE" && url.pathname.startsWith("/subscribers/")) {
      const id = url.pathname.split("/")[2];
      const idx = subscribers.findIndex((s) => s.id === id);
      if (idx < 0) return Response.json({ error: "Not found" }, { status: 404 });

      subscribers.splice(idx, 1);
      saveSubscribers();
      return new Response(null, { status: 204 });
    }

    // Unsubscribe by email (convenience)
    if (method === "POST" && url.pathname === "/unsubscribe") {
      try {
        const body = await req.json();
        const { email } = body as { email: string };
        const idx = subscribers.findIndex((s) => s.email === email);
        if (idx < 0) return Response.json({ error: "Email not found" }, { status: 404 });

        subscribers.splice(idx, 1);
        saveSubscribers();
        return Response.json({ message: "Unsubscribed successfully" });
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    // Manual trigger (for testing)
    if (method === "POST" && url.pathname === "/trigger") {
      await runDigests();
      return Response.json({ message: "Digest run triggered" });
    }

    // Preview email for a subscriber
    if (method === "GET" && url.pathname === "/preview") {
      const bounties = await fetchOpenBounties();
      const tags = url.searchParams.get("tags")?.split(",") || [];
      const filtered = filterByTags(bounties, tags);
      const html = renderDigestHtml(filtered, "preview@example.com");
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // Service health
    if (method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "ok",
        subscribers: subscribers.length,
        activeSubscribers: subscribers.filter((s) => s.active).length,
        lastDailyRun: digestState.lastDailyRun,
        lastWeeklyRun: digestState.lastWeeklyRun,
        resendConfigured: !!RESEND_API_KEY,
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

// --- Helper ---
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

// --- Start ---
loadSubscribers();
loadState();

console.log(`Email Digest Service running on http://localhost:${PORT}`);
console.log(`Monitoring: ${API_BASE}`);
console.log(`Subscribers: ${subscribers.length}`);
console.log(`Resend API: ${RESEND_API_KEY ? "configured" : "NOT configured (dry run mode)"}`);
console.log(`Check interval: ${CHECK_INTERVAL / 1000 / 60} minutes`);

// Check periodically
setInterval(runDigests, CHECK_INTERVAL);
