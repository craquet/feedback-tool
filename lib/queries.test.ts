import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../db/client";
import { feedback, services } from "../db/schema";
import {
  createService,
  getFeedback,
  getServiceBySlug,
  listFeedback,
  listServicesWithCounts,
  regenerateEmbedKey,
  setFeedbackStatus,
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
});
