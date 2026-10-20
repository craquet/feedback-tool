import type { AppDb } from "../db/client";
import { notificationLog, type WebhookFormat } from "../db/schema";

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
