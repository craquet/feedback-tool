import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db } from "../db/client";
import { feedback, services } from "../db/schema";
import { saveScreenshot } from "./storage";
import {
  createService,
  deleteFeedback,
  deleteFeedbackBulkWithScreenshots,
  deleteFeedbackWithScreenshot,
  getFeedback,
  getServiceBySlug,
  listFeedback,
  listFeedbackForCsv,
  listServicesWithCounts,
  regenerateEmbedKey,
  setFeedbackStatus,
  setFeedbackStatusBulk,
  updateService,
} from "./queries";

describe("admin queries", () => {
  let db: Db;
  let serviceId: number;

  beforeEach(() => {
    db = createDb(":memory:");
    const svc = db.db
      .insert(services)
      .values({ name: "App X", slug: "app-x", embedKey: "k1" })
      .returning()
      .get();
    serviceId = svc.id;
  });

  afterEach(() => {
    db.sqlite.close();
  });

  function addFeedback(overrides: Partial<{ status: string; message: string }> = {}) {
    return db.db
      .insert(feedback)
      .values({ serviceId, message: overrides.message ?? "m", status: overrides.status as never })
      .returning()
      .get();
  }

  describe("getServiceBySlug", () => {
    it("returns the service for a known slug", () => {
      expect(getServiceBySlug(db.db, "app-x")?.id).toBe(serviceId);
    });

    it("returns null for an unknown slug", () => {
      expect(getServiceBySlug(db.db, "nope")).toBeNull();
    });
  });

  describe("listServicesWithCounts", () => {
    it("returns totals and unread counts per service", () => {
      addFeedback({ status: "new" });
      addFeedback({ status: "new" });
      addFeedback({ status: "read" });

      const list = listServicesWithCounts(db.db);

      expect(list).toHaveLength(1);
      expect(list[0].service.id).toBe(serviceId);
      expect(list[0].total).toBe(3);
      expect(list[0].unread).toBe(2);
    });

    it("returns zero counts for a service without feedback", () => {
      const list = listServicesWithCounts(db.db);

      expect(list[0].total).toBe(0);
      expect(list[0].unread).toBe(0);
    });

    it("aggregates multiple services", () => {
      db.db
        .insert(services)
        .values({ name: "App Y", slug: "app-y", embedKey: "k2" })
        .run();
      addFeedback({ status: "new" });

      const list = listServicesWithCounts(db.db);

      expect(list).toHaveLength(2);
      const appX = list.find((s) => s.service.slug === "app-x");
      const appY = list.find((s) => s.service.slug === "app-y");
      expect(appX?.total).toBe(1);
      expect(appY?.total).toBe(0);
    });
  });

  describe("listFeedback", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        const row = addFeedback({ message: `msg ${i}` });
        // make created_at deterministic and increasing
        db.db
          .update(feedback)
          .set({ createdAt: new Date(2026, 0, i) })
          .where(eq(feedback.id, row.id))
          .run();
      }
      const readOne = db.db.select().from(feedback).all()[0];
      db.db
        .update(feedback)
        .set({ status: "read" })
        .where(eq(feedback.id, readOne.id))
        .run();
    });

    it("returns newest first", () => {
      const { items } = listFeedback(db.db, { serviceId });

      expect(items).toHaveLength(5);
      expect(items[0].message).toBe("msg 5");
      expect(items[4].message).toBe("msg 1");
    });

    it("filters by status", () => {
      const { items, total } = listFeedback(db.db, { serviceId, status: "read" });

      expect(total).toBe(1);
      expect(items).toHaveLength(1);
      expect(items[0].status).toBe("read");
    });

    it("paginates with page and pageSize", () => {
      const page1 = listFeedback(db.db, { serviceId, page: 1, pageSize: 2 });
      const page2 = listFeedback(db.db, { serviceId, page: 2, pageSize: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.items[0].message).toBe("msg 3");
    });
  });

  describe("getFeedback", () => {
    it("returns the feedback joined with its service", () => {
      const row = addFeedback({ message: "specific message" });

      const result = getFeedback(db.db, row.id);

      expect(result?.feedback.message).toBe("specific message");
      expect(result?.service.slug).toBe("app-x");
    });

    it("returns null for unknown ids", () => {
      expect(getFeedback(db.db, 999)).toBeNull();
    });
  });

  describe("setFeedbackStatus", () => {
    it("updates the status", () => {
      const row = addFeedback({ status: "new" });

      setFeedbackStatus(db.db, row.id, "archived");

      const updated = db.db.select().from(feedback).all()[0];
      expect(updated.status).toBe("archived");
    });
  });

  describe("createService", () => {
    it("creates a service with a generated embed key", () => {
      const result = createService(db.db, { name: "New App", slug: "new-app" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.service.embedKey).toMatch(/^fb_[0-9a-f]{32}$/);
        expect(result.service.name).toBe("New App");
        expect(result.service.webhookUrl).toBeNull();
      }
    });

    it("rejects a duplicate slug", () => {
      const result = createService(db.db, { name: "Dup", slug: "app-x" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/already exists/i);
      }
    });
  });

  describe("updateService", () => {
    it("updates name and webhook url", () => {
      updateService(db.db, serviceId, {
        name: "Renamed",
        webhookUrl: "https://hooks.example.com/x",
      });

      const updated = db.db.select().from(services).all()[0];
      expect(updated.name).toBe("Renamed");
      expect(updated.webhookUrl).toBe("https://hooks.example.com/x");
    });

    it("clears the webhook url when null is passed", () => {
      updateService(db.db, serviceId, { webhookUrl: "https://hooks.example.com/x" });
      updateService(db.db, serviceId, { webhookUrl: null });

      const updated = db.db.select().from(services).all()[0];
      expect(updated.webhookUrl).toBeNull();
    });

    it("updates the accepting flags", () => {
      updateService(db.db, serviceId, {
        acceptingReports: false,
        acceptingScreenshots: false,
      });

      const updated = db.db.select().from(services).all()[0];
      expect(updated.acceptingReports).toBe(false);
      expect(updated.acceptingScreenshots).toBe(false);
    });

    it("does not touch flags that are not passed", () => {
      updateService(db.db, serviceId, { acceptingReports: false });
      updateService(db.db, serviceId, { name: "Only name" });

      const updated = db.db.select().from(services).all()[0];
      expect(updated.acceptingReports).toBe(false);
      expect(updated.acceptingScreenshots).toBe(true);
    });

    it("updates the webhook format", () => {
      updateService(db.db, serviceId, { webhookFormat: "microsoft-teams" });

      const updated = db.db.select().from(services).all()[0];
      expect(updated.webhookFormat).toBe("microsoft-teams");
    });
  });

  describe("regenerateEmbedKey", () => {
    it("replaces the embed key with a new unique one", () => {
      const before = db.db.select().from(services).all()[0].embedKey;

      const newKey = regenerateEmbedKey(db.db, serviceId);

      expect(newKey).toMatch(/^fb_[0-9a-f]{32}$/);
      expect(newKey).not.toBe(before);
      expect(db.db.select().from(services).all()[0].embedKey).toBe(newKey);
    });
  });

  describe("deleteFeedback", () => {
    it("removes the feedback row", () => {
      const row = addFeedback({ message: "to be deleted" });

      deleteFeedback(db.db, row.id);

      expect(getFeedback(db.db, row.id)).toBeNull();
    });

    it("silently ignores unknown ids", () => {
      expect(() => deleteFeedback(db.db, 99999)).not.toThrow();
    });
  });

  describe("deleteFeedbackWithScreenshot", () => {
    it("deletes the row and the attached screenshot file", async () => {
      const screenshotsDir = mkdtempSync(path.join(tmpdir(), "delete-shots-"));
      try {
        const saved = await saveScreenshot({
          rootDir: screenshotsDir,
          serviceSlug: "app-x",
          file: new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }),
        });
        if (!saved.ok) throw new Error("setup failed");
        const row = db.db
          .insert(feedback)
          .values({ serviceId, message: "with shot", screenshotPath: saved.path })
          .returning()
          .get();

        deleteFeedbackWithScreenshot(db.db, row.id, screenshotsDir);

        expect(getFeedback(db.db, row.id)).toBeNull();
        expect(existsSync(path.join(screenshotsDir, saved.path))).toBe(false);
      } finally {
        rmSync(screenshotsDir, { recursive: true, force: true });
      }
    });

    it("deletes the row when there is no screenshot", () => {
      const row = addFeedback({ message: "no shot" });

      deleteFeedbackWithScreenshot(db.db, row.id, "/nonexistent-root");

      expect(getFeedback(db.db, row.id)).toBeNull();
    });
  });

  describe("setFeedbackStatusBulk", () => {
    it("updates the status of all given ids", () => {
      const a = addFeedback({});
      const b = addFeedback({});
      const c = addFeedback({});

      setFeedbackStatusBulk(db.db, [a.id, b.id], "read");

      expect(getFeedback(db.db, a.id)?.feedback.status).toBe("read");
      expect(getFeedback(db.db, b.id)?.feedback.status).toBe("read");
      expect(getFeedback(db.db, c.id)?.feedback.status).toBe("new");
    });

    it("ignores unknown ids", () => {
      addFeedback({});

      expect(() => setFeedbackStatusBulk(db.db, [99999], "read")).not.toThrow();
    });

    it("is a no-op for an empty list", () => {
      addFeedback({});

      expect(() => setFeedbackStatusBulk(db.db, [], "archived")).not.toThrow();
      const rows = db.db.select().from(feedback).all();
      expect(rows[0].status).toBe("new");
    });
  });

  describe("deleteFeedbackBulkWithScreenshots", () => {
    it("deletes rows and their screenshots", async () => {
      const screenshotsDir = mkdtempSync(path.join(tmpdir(), "feedback-bulk-"));
      try {
        const shotA = await saveScreenshot({
          rootDir: screenshotsDir,
          serviceSlug: "app-x",
          file: new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
        });
        const shotB = await saveScreenshot({
          rootDir: screenshotsDir,
          serviceSlug: "app-x",
          file: new File([new Uint8Array([2])], "b.png", { type: "image/png" }),
        });
        if (!shotA.ok || !shotB.ok) throw new Error("setup failed");
        const a = db.db
          .insert(feedback)
          .values({ serviceId, message: "a", screenshotPath: shotA.path })
          .returning()
          .get();
        const b = db.db
          .insert(feedback)
          .values({ serviceId, message: "b", screenshotPath: shotB.path })
          .returning()
          .get();
        const kept = addFeedback({ message: "kept" });

        deleteFeedbackBulkWithScreenshots(db.db, [a.id, b.id], screenshotsDir);

        expect(getFeedback(db.db, a.id)).toBeNull();
        expect(getFeedback(db.db, b.id)).toBeNull();
        expect(getFeedback(db.db, kept.id)).not.toBeNull();
        expect(existsSync(path.join(screenshotsDir, shotA.path))).toBe(false);
        expect(existsSync(path.join(screenshotsDir, shotB.path))).toBe(false);
      } finally {
        rmSync(screenshotsDir, { recursive: true, force: true });
      }
    });

    it("is a no-op for an empty list", () => {
      addFeedback({});

      expect(() =>
        deleteFeedbackBulkWithScreenshots(db.db, [], "/nonexistent-root"),
      ).not.toThrow();
      expect(db.db.select().from(feedback).all()).toHaveLength(1);
    });
  });

  describe("listFeedbackForCsv", () => {
    it("returns all feedback of the service ordered oldest first", () => {
      const a = addFeedback({ message: "first" });
      const b = addFeedback({ message: "second" });
      const other = db.db
        .insert(services)
        .values({ name: "App Y", slug: "app-y", embedKey: "k2" })
        .returning()
        .get();
      db.db
        .insert(feedback)
        .values({ serviceId: other.id, message: "other service" })
        .run();

      const rows = listFeedbackForCsv(db.db, serviceId);

      expect(rows.map((r) => r.id)).toEqual([a.id, b.id]);
      expect(rows.map((r) => r.message)).toEqual(["first", "second"]);
    });
  });
});
