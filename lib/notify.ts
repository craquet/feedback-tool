import type { AppDb } from "../db/client";
import { notificationLog, type WebhookFormat } from "../db/schema";

// --- SSRF guard -------------------------------------------------------------
// Webhook URLs are admin-supplied, but the request is made from the server, so
// a crafted URL could reach internal services (cloud metadata, localhost, the
// admin UI itself). Block non-http(s) schemes, internal hostnames, and
// private/reserved IP literals. DNS is not resolved here, so rebinding via a
// public hostname remains a residual risk for high-threat deployments.

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

function parseIPv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    octets.push(octet);
  }
  return octets;
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8 private
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    a >= 224 // multicast and reserved
  );
}

function isPrivateIPv6(address: string): boolean {
  if (address === "::" || address === "::1") {
    return true;
  }
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:aabb:ccdd) and IPv4-compatible
  // (::aabb:ccdd) forms: judge the embedded IPv4 address instead. The URL
  // parser normalizes dotted IPv4 into hex hextets, so handle both shapes.
  const dotted = address.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i);
  const hex = address.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (dotted) {
    const octets = parseIPv4(dotted[1]);
    return octets === null || isPrivateIPv4(octets);
  }
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }
  const firstHextet = address.split(":")[0] ?? "";
  if (firstHextet.length >= 2) {
    const lead = parseInt(firstHextet.slice(0, 2), 16);
    if (Number.isNaN(lead)) {
      return false;
    }
    if (lead === 0xfc || lead === 0xfd) {
      return true; // fc00::/7 unique local
    }
    if (lead === 0xfe) {
      const second = parseInt(firstHextet.slice(2, 4) || "0", 16);
      return second >= 0x80 && second <= 0xbf; // fe80::/10 link-local
    }
    if (lead === 0xff) {
      return true; // ff00::/8 multicast
    }
  }
  return false;
}

export function isBlockedWebhookUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return true;
  }
  // WHATWG URL parsing already normalizes hex/octal/decimal IP forms
  // (e.g. http://0x7f000001/ becomes 127.0.0.1) before we inspect them.
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return true;
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return true;
  }
  const bare = hostname.replace(/^\[|\]$/g, "");
  const octets = parseIPv4(bare);
  if (octets) {
    return isPrivateIPv4(octets);
  }
  if (bare.includes(":")) {
    return isPrivateIPv6(bare);
  }
  return false;
}

export interface FeedbackNotificationPayload {
  id: number;
  message: string;
  email: string | null;
  pageUrl: string | null;
  screenshotPath: string | null;
  createdAt: Date;
}

export interface SendFeedbackNotificationArgs {
  db: AppDb;
  fetchImpl?: typeof fetch;
  webhookUrl: string;
  format?: WebhookFormat;
  adminUrl: string;
  serviceName: string;
  feedback: FeedbackNotificationPayload;
}

interface WebhookContentData {
  serviceName: string;
  adminUrl: string;
  feedback: FeedbackNotificationPayload;
}

export interface TeamsCardMessage {
  type: "message";
  attachments: Array<{
    contentType: string;
    contentUrl: null;
    content: {
      type: "AdaptiveCard";
      $schema: string;
      version: string;
      summary: string;
      body: Array<
        | { type: "TextBlock"; text: string; weight?: string; size?: string; wrap?: boolean }
        | { type: "FactSet"; facts: Array<{ title: string; value: string }> }
      >;
      actions?: Array<{ type: "Action.OpenUrl"; title: string; url: string }>;
    };
  }>;
}

export function buildFeedbackBody(
  format: WebhookFormat,
  data: WebhookContentData,
): string {
  if (format === "microsoft-teams") {
    const facts: Array<{ title: string; value: string }> = [];
    if (data.feedback.email) {
      facts.push({ title: "Email", value: data.feedback.email });
    }
    if (data.feedback.pageUrl) {
      facts.push({ title: "Page URL", value: data.feedback.pageUrl });
    }
    return JSON.stringify(
      adaptiveCardMessage({
        summary: summarizeText(
          `New feedback for ${data.serviceName}: ${data.feedback.message}`,
        ),
        title: `New feedback for ${data.serviceName}`,
        message: data.feedback.message,
        facts,
        actions: [
          { type: "Action.OpenUrl", title: "Open in admin", url: data.adminUrl },
        ],
      }),
    );
  }

  return JSON.stringify({
    serviceName: data.serviceName,
    feedbackId: data.feedback.id,
    message: data.feedback.message,
    email: data.feedback.email,
    pageUrl: data.feedback.pageUrl,
    hasScreenshot: data.feedback.screenshotPath !== null,
    createdAt: data.feedback.createdAt.toISOString(),
    adminUrl: data.adminUrl,
  });
}

export function buildTestBody(
  format: WebhookFormat,
  data: { serviceName: string; message: string },
): string {
  if (format === "microsoft-teams") {
    return JSON.stringify(
      adaptiveCardMessage({
        summary: summarizeText(`Test notification for ${data.serviceName}`),
        title: `Test notification for ${data.serviceName}`,
        message: data.message,
        facts: [],
        actions: [],
      }),
    );
  }
  return JSON.stringify({ test: true, ...data });
}

// Teams uses the card's top-level `summary` as the notification preview text;
// keep it short and on a single line.
const SUMMARY_MAX_LENGTH = 140;

function summarizeText(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= SUMMARY_MAX_LENGTH) {
    return singleLine;
  }
  return `${singleLine.slice(0, SUMMARY_MAX_LENGTH - 1)}…`;
}

function adaptiveCardMessage(content: {
  summary: string;
  title: string;
  message: string;
  facts: Array<{ title: string; value: string }>;
  actions: Array<{ type: "Action.OpenUrl"; title: string; url: string }>,
}): TeamsCardMessage {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          type: "AdaptiveCard",
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          summary: content.summary,
          body: [
            {
              type: "TextBlock",
              text: content.title,
              weight: "Bolder",
              size: "Medium",
            },
            { type: "TextBlock", text: content.message, wrap: true },
            ...(content.facts.length
              ? [{ type: "FactSet" as const, facts: content.facts }]
              : []),
          ],
          ...(content.actions.length ? { actions: content.actions } : {}),
        },
      },
    ],
  };
}

const ATTEMPT_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;

export interface WebhookOutcome {
  ok: boolean;
  responseStatus: number | null;
  error: string | null;
}

export async function deliverWebhook(
  url: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebhookOutcome> {
  if (isBlockedWebhookUrl(url)) {
    return {
      ok: false,
      responseStatus: null,
      error: "Webhook URL points to a blocked host",
    };
  }
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    return {
      ok: response.ok,
      responseStatus: response.status,
      error: response.ok ? null : `Webhook responded with status ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      responseStatus: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendFeedbackNotification(
  args: SendFeedbackNotificationArgs,
): Promise<void> {
  const {
    db,
    fetchImpl = fetch,
    webhookUrl,
    format = "generic",
    adminUrl,
    serviceName,
    feedback,
  } = args;

  const body = buildFeedbackBody(format, {
    serviceName,
    adminUrl,
    feedback,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await deliverWebhook(webhookUrl, body, fetchImpl);
    await logAttempt(db, {
      feedbackId: feedback.id,
      webhookUrl,
      ok: outcome.ok,
      responseStatus: outcome.responseStatus,
      error: outcome.error,
    });
    if (outcome.ok) return;
  }
}

async function logAttempt(
  db: AppDb,
  attempt: {
    feedbackId: number;
    webhookUrl: string;
    ok: boolean;
    responseStatus: number | null;
    error: string | null;
  },
): Promise<void> {
  try {
    await db.insert(notificationLog).values(attempt);
  } catch {
    // logging must never break feedback submission
  }
}
