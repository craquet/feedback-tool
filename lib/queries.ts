import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { feedback, services, type FeedbackStatus, type WebhookFormat } from "../db/schema";
import { deleteScreenshot } from "./storage";

export type Service = typeof services.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;

export function getServiceBySlug(db: AppDb, slug: string): Service | null {
  return db.select().from(services).where(eq(services.slug, slug)).all()[0] ?? null;
}

export interface ServiceWithCounts {
  service: Service;
  total: number;
  unread: number;
}

export function listServicesWithCounts(db: AppDb): ServiceWithCounts[] {
  const rows = db
    .select({
      service: services,
      total: count(feedback.id),
      unread: sql<number>`coalesce(sum(case when ${feedback.status} = 'new' then 1 else 0 end), 0)`,
    })
    .from(services)
    .leftJoin(feedback, eq(feedback.serviceId, services.id))
    .groupBy(services.id)
    .orderBy(asc(services.name))
    .all();
  return rows.map((row) => ({
    service: row.service,
    total: Number(row.total),
    unread: Number(row.unread),
  }));
}

export interface ListFeedbackArgs {
  serviceId: number;
  status?: FeedbackStatus;
  page?: number;
  pageSize?: number;
}

export interface FeedbackList {
  items: FeedbackRow[];
  total: number;
}

export function listFeedback(db: AppDb, args: ListFeedbackArgs): FeedbackList {
  const { serviceId, status, page = 1, pageSize = 20 } = args;
  const conditions = [eq(feedback.serviceId, serviceId)];
  if (status) {
    conditions.push(eq(feedback.status, status));
  }
  const where = and(...conditions);

  const items = db
    .select()
    .from(feedback)
    .where(where)
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const total = Number(
    db.select({ value: count() }).from(feedback).where(where).all()[0].value,
  );

  return { items, total };
}

export function getFeedback(
  db: AppDb,
  id: number,
): { feedback: FeedbackRow; service: Service } | null {
  const row = db
    .select({ fb: feedback, svc: services })
    .from(feedback)
    .innerJoin(services, eq(feedback.serviceId, services.id))
    .where(eq(feedback.id, id))
    .all()[0];
  return row ? { feedback: row.fb, service: row.svc } : null;
}

export function setFeedbackStatus(
  db: AppDb,
  id: number,
  status: FeedbackStatus,
): void {
  db.update(feedback).set({ status }).where(eq(feedback.id, id)).run();
}

export function deleteFeedback(db: AppDb, id: number): void {
  db.delete(feedback).where(eq(feedback.id, id)).run();
}

export function setFeedbackStatusBulk(
  db: AppDb,
  ids: number[],
  status: FeedbackStatus,
): void {
  if (ids.length === 0) {
    return;
  }
  db.update(feedback).set({ status }).where(inArray(feedback.id, ids)).run();
}

export function deleteFeedbackBulkWithScreenshots(
  db: AppDb,
  ids: number[],
  rootDir: string,
): void {
  if (ids.length === 0) {
    return;
  }
  const rows = db
    .select({ screenshotPath: feedback.screenshotPath })
    .from(feedback)
    .where(inArray(feedback.id, ids))
    .all();
  for (const row of rows) {
    if (row.screenshotPath) {
      deleteScreenshot(rootDir, row.screenshotPath);
    }
  }
  db.delete(feedback).where(inArray(feedback.id, ids)).run();
}

export function listFeedbackForCsv(db: AppDb, serviceId: number): FeedbackRow[] {
  return db
    .select()
    .from(feedback)
    .where(eq(feedback.serviceId, serviceId))
    .orderBy(asc(feedback.createdAt), asc(feedback.id))
    .all();
}

export function deleteFeedbackWithScreenshot(
  db: AppDb,
  id: number,
  rootDir: string,
): void {
  const row = db
    .select({ screenshotPath: feedback.screenshotPath })
    .from(feedback)
    .where(eq(feedback.id, id))
    .all()[0];
  if (row?.screenshotPath) {
    deleteScreenshot(rootDir, row.screenshotPath);
  }
  deleteFeedback(db, id);
}

export function deleteService(db: AppDb, id: number, rootDir: string): void {
  const rows = db
    .select({ screenshotPath: feedback.screenshotPath })
    .from(feedback)
    .where(eq(feedback.serviceId, id))
    .all();
  for (const row of rows) {
    if (row.screenshotPath) {
      deleteScreenshot(rootDir, row.screenshotPath);
    }
  }
  // feedback and notification_log rows go with the service via ON DELETE CASCADE
  db.delete(services).where(eq(services.id, id)).run();
}

export type CreateServiceResult =
  | { ok: true; service: Service }
  | { ok: false; error: string };

export function createService(
  db: AppDb,
  input: { name: string; slug: string; webhookUrl?: string | null },
): CreateServiceResult {
  const slugPattern = /^[a-z0-9][a-z0-9-]*$/;
  if (!slugPattern.test(input.slug)) {
    return { ok: false, error: "Slug may only contain lowercase letters, digits and dashes" };
  }
  if (getServiceBySlug(db, input.slug)) {
    return { ok: false, error: "A service with this slug already exists" };
  }
  const service = db
    .insert(services)
    .values({
      name: input.name,
      slug: input.slug,
      embedKey: generateEmbedKey(),
      webhookUrl: input.webhookUrl ?? null,
    })
    .returning()
    .get();
  return { ok: true, service };
}

export function updateService(
  db: AppDb,
  id: number,
  patch: {
    name?: string;
    webhookUrl?: string | null;
    webhookFormat?: WebhookFormat;
    acceptingReports?: boolean;
    acceptingScreenshots?: boolean;
  },
): void {
  db.update(services).set(patch).where(eq(services.id, id)).run();
}

export function regenerateEmbedKey(db: AppDb, id: number): string {
  const embedKey = generateEmbedKey();
  db.update(services).set({ embedKey }).where(eq(services.id, id)).run();
  return embedKey;
}

function generateEmbedKey(): string {
  return `fb_${randomBytes(16).toString("hex")}`;
}
