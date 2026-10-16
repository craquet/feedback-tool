import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "./client";
import { feedback, services } from "./schema";

describe("schema + migrations", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  afterEach(() => {
    db.sqlite.close();
  });

  describe("services", () => {
    it("inserts a service with generated id and created_at", () => {
      const row = db.db
        .insert(services)
        .values({ name: "App X", slug: "app-x", embedKey: "k_appx_1" })
        .returning()
        .get();

      expect(row.id).toBeGreaterThan(0);
      expect(row.name).toBe("App X");
      expect(row.slug).toBe("app-x");
      expect(row.embedKey).toBe("k_appx_1");
      expect(row.webhookUrl).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
    });

    it("rejects a duplicate slug", () => {
      db.db
        .insert(services)
        .values({ name: "A", slug: "dup", embedKey: "k1" })
        .run();

      expect(() =>
        db.db
          .insert(services)
          .values({ name: "B", slug: "dup", embedKey: "k2" })
          .run(),
      ).toThrow(/UNIQUE constraint failed/);
    });

    it("rejects a duplicate embed key", () => {
      db.db
        .insert(services)
        .values({ name: "A", slug: "a", embedKey: "same" })
        .run();

      expect(() =>
        db.db
          .insert(services)
          .values({ name: "B", slug: "b", embedKey: "same" })
          .run(),
      ).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe("feedback", () => {
    let serviceId: number;

    beforeEach(() => {
      const row = db.db
        .insert(services)
        .values({ name: "App X", slug: "app-x", embedKey: "k_appx_1" })
        .returning()
        .get();
      serviceId = row.id;
    });

    it("inserts feedback with status defaulting to 'new'", () => {
      const row = db.db
        .insert(feedback)
        .values({ serviceId, message: "Something broke" })
        .returning()
        .get();

      expect(row.id).toBeGreaterThan(0);
      expect(row.serviceId).toBe(serviceId);
      expect(row.message).toBe("Something broke");
      expect(row.status).toBe("new");
      expect(row.email).toBeNull();
      expect(row.screenshotPath).toBeNull();
      expect(row.pageUrl).toBeNull();
      expect(row.userAgent).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
    });

    it("rejects feedback referencing an unknown service", () => {
      expect(() =>
        db.db
          .insert(feedback)
          .values({ serviceId: serviceId + 999, message: "hi" })
          .run(),
      ).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("rejects invalid status values", () => {
      expect(() =>
        db.db
          .insert(feedback)
          .values({ serviceId, message: "hi", status: "bogus" as never })
          .run(),
      ).toThrow();
    });

    it("cascades deletion from service to its feedback", () => {
      db.db
        .insert(feedback)
        .values({ serviceId, message: "hi" })
        .returning()
        .get();

      db.db.delete(services).where(eq(services.id, serviceId)).run();

      expect(db.db.select().from(feedback).all()).toHaveLength(0);
    });
  });
});
