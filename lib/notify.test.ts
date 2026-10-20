import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "../db/client";
import { notificationLog, services, feedback } from "../db/schema";
import {
  sendFeedbackNotification,
  buildFeedbackBody,
  buildTestBody,
  type TeamsCardMessage,
} from "./notify";

describe("sendFeedbackNotification", () => {
  let db: Db;
  let serviceId: number;
  let feedbackId: number;

  beforeEach(() => {
    db = createDb(":memory:");
    const service = db.db
      .insert(services)
      .values({ name: "App X", slug: "app-x", embedKey: "k1", webhookUrl: "https://hooks.example.com/team" })
      .returning()
      .get();
    serviceId = service.id;
    const row = db.db
      .insert(feedback)
      .values({ serviceId, message: "The export button is broken" })
      .returning()
      .get();
    feedbackId = row.id;
  });

  afterEach(() => {
    db.sqlite.close();
    vi.restoreAllMocks();
  });

  it("posts the payload to the configured webhook", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await sendFeedbackNotification({
      db: db.db,
      fetchImpl,
      webhookUrl: "https://hooks.example.com/team",
      adminUrl: "https://feedback.example.com/admin/app-x/1",
      feedback: {
        id: feedbackId,
        message: "The export button is broken",
        email: null,
        pageUrl: null,
        screenshotPath: null,
        createdAt: new Date(2026, 0, 1),
      },
      serviceName: "App X",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/team");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      serviceName: "App X",
      feedbackId,
      message: "The export button is broken",
      adminUrl: "https://feedback.example.com/admin/app-x/1",
    });
  });

  it("logs a successful delivery", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await sendFeedbackNotification({
      db: db.db,
      fetchImpl,
      webhookUrl: "https://hooks.example.com/team",
      adminUrl: "https://feedback.example.com/admin/app-x/1",
      feedback: { id: feedbackId, message: "m", email: null, pageUrl: null, screenshotPath: null, createdAt: new Date() },
      serviceName: "App X",
    });

    const logs = db.db.select().from(notificationLog).all();
    expect(logs).toHaveLength(1);
    expect(logs[0].ok).toBe(true);
    expect(logs[0].responseStatus).toBe(200);
    expect(logs[0].feedbackId).toBe(feedbackId);
  });

  it("retries once and logs both attempts when the webhook returns an error status", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await sendFeedbackNotification({
      db: db.db,
      fetchImpl,
      webhookUrl: "https://hooks.example.com/team",
      adminUrl: "https://feedback.example.com/admin/app-x/1",
      feedback: { id: feedbackId, message: "m", email: null, pageUrl: null, screenshotPath: null, createdAt: new Date() },
      serviceName: "App X",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const logs = db.db.select().from(notificationLog).all();
    expect(logs).toHaveLength(2);
    for (const log of logs) {
      expect(log.ok).toBe(false);
      expect(log.responseStatus).toBe(500);
    }
  });

  it("logs a recovered delivery when the retry succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue(new Response(null, { status: 200 }));

    await sendFeedbackNotification({
      db: db.db,
      fetchImpl,
      webhookUrl: "https://hooks.example.com/team",
      adminUrl: "https://feedback.example.com/admin/app-x/1",
      feedback: { id: feedbackId, message: "m", email: null, pageUrl: null, screenshotPath: null, createdAt: new Date() },
      serviceName: "App X",
    });

    const logs = db.db.select().from(notificationLog).all();
    expect(logs).toHaveLength(2);
    expect(logs[0].ok).toBe(false);
    expect(logs[0].error).toMatch(/connection reset/);
    expect(logs[1].ok).toBe(true);
  });

  it("never throws, even when logging fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      sendFeedbackNotification({
        db: db.db,
        fetchImpl,
        webhookUrl: "https://hooks.example.com/team",
        adminUrl: "https://feedback.example.com/admin/app-x/1",
        feedback: { id: feedbackId, message: "m", email: null, pageUrl: null, screenshotPath: null, createdAt: new Date() },
        serviceName: "App X",
      }),
    ).resolves.toBeUndefined();

    const logs = db.db.select().from(notificationLog).all();
    expect(logs.length).toBe(2);
    expect(logs.every((l) => !l.ok)).toBe(true);
  });
});

describe("webhook payload builders", () => {
  const baseFeedback = {
    id: 7,
    message: "The export button is broken",
    email: "jane@example.com",
    pageUrl: "https://app.example.com/reports",
    screenshotPath: null,
    createdAt: new Date(2026, 0, 1),
  };

  it("sends a Microsoft Teams adaptive card when the format is microsoft-teams", async () => {
    const localDb = createDb(":memory:");
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await sendFeedbackNotification({
      db: localDb.db,
      fetchImpl,
      format: "microsoft-teams",
      webhookUrl: "https://hooks.example.com/flow",
      adminUrl: "https://feedback.example.com/admin/app-x/7",
      feedback: baseFeedback,
      serviceName: "App X",
    });

    const [, init] = fetchImpl.mock.calls[0];
    const payload: TeamsCardMessage = JSON.parse(init.body);

    expect(payload.type).toBe("message");
    expect(payload.attachments).toHaveLength(1);
    const attachment = payload.attachments[0];
    expect(attachment.contentType).toBe("application/vnd.microsoft.card.adaptive");

    const card = attachment.content;
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.4");

    expect(card.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "TextBlock",
          text: expect.stringContaining("App X"),
        }),
        expect.objectContaining({
          type: "TextBlock",
          text: "The export button is broken",
        }),
        expect.objectContaining({
          type: "FactSet",
          facts: expect.arrayContaining([
            expect.objectContaining({ value: "jane@example.com" }),
            expect.objectContaining({ value: "https://app.example.com/reports" }),
          ]),
        }),
      ]),
    );

    expect(card.actions).toEqual([
      expect.objectContaining({
        type: "Action.OpenUrl",
        title: "Open in admin",
        url: "https://feedback.example.com/admin/app-x/7",
      }),
    ]);
    localDb.sqlite.close();
  });

  it("omits email and page facts when they are absent", () => {
    const body: TeamsCardMessage = JSON.parse(
      buildFeedbackBody("microsoft-teams", {
        serviceName: "App X",
        adminUrl: "https://feedback.example.com/admin/app-x/7",
        feedback: { ...baseFeedback, email: null, pageUrl: null },
      }),
    );
    expect(
      body.attachments[0].content.body.find((b) => b.type === "FactSet"),
    ).toBeUndefined();
  });

  it("includes a single-line summary so Teams previews the feedback", () => {
    const body: TeamsCardMessage = JSON.parse(
      buildFeedbackBody("microsoft-teams", {
        serviceName: "App X",
        adminUrl: "https://feedback.example.com/admin/app-x/7",
        feedback: baseFeedback,
      }),
    );
    expect(body.attachments[0].content.summary).toBe(
      "New feedback for App X: The export button is broken",
    );
  });

  it("collapses newlines and truncates long summaries", () => {
    const body: TeamsCardMessage = JSON.parse(
      buildFeedbackBody("microsoft-teams", {
        serviceName: "App X",
        adminUrl: "https://feedback.example.com/admin/app-x/7",
        feedback: { ...baseFeedback, message: `first line\n${"x".repeat(300)}` },
      }),
    );
    const summary = body.attachments[0].content.summary;
    expect(summary).not.toContain("\n");
    expect(summary.length).toBeLessThanOrEqual(140);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("builds a flat payload for the generic format", () => {
    const body = JSON.parse(
      buildFeedbackBody("generic", {
        serviceName: "App X",
        adminUrl: "https://feedback.example.com/admin/app-x/7",
        feedback: baseFeedback,
      }),
    ) as Record<string, unknown>;
    expect(body.message).toBe("The export button is broken");
    expect(body.attachments).toBeUndefined();
  });

  it("builds a test payload with the requested format", () => {
    const generic = JSON.parse(
      buildTestBody("generic", { serviceName: "App X", message: "Test notification" }),
    ) as Record<string, unknown>;
    expect(generic).toEqual({ test: true, serviceName: "App X", message: "Test notification" });

    const teams: TeamsCardMessage = JSON.parse(
      buildTestBody("microsoft-teams", { serviceName: "App X", message: "Test notification" }),
    );
    expect(teams.attachments[0].content.type).toBe("AdaptiveCard");
    expect(teams.attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(teams.attachments[0].content.summary).toBe("Test notification for App X");
  });
});
