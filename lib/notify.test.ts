import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "../db/client";
import { notificationLog, services, feedback } from "../db/schema";
import { sendFeedbackNotification } from "./notify";

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
