import type { AppDb } from "../db/client";
import { notificationLog } from "../db/schema";

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
  adminUrl: string;
  serviceName: string;
  feedback: FeedbackNotificationPayload;
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
    adminUrl,
    serviceName,
    feedback,
  } = args;

  const body = JSON.stringify({
    serviceName,
    feedbackId: feedback.id,
    message: feedback.message,
    email: feedback.email,
    pageUrl: feedback.pageUrl,
    hasScreenshot: feedback.screenshotPath !== null,
    createdAt: feedback.createdAt.toISOString(),
    adminUrl,
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
