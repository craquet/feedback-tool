import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const feedbackStatus = ["new", "read", "archived"] as const;
export type FeedbackStatus = (typeof feedbackStatus)[number];

export const webhookFormats = ["generic", "microsoft-teams"] as const;
export type WebhookFormat = (typeof webhookFormats)[number];

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  embedKey: text("embed_key").notNull().unique(),
  webhookUrl: text("webhook_url"),
  webhookFormat: text("webhook_format", { enum: webhookFormats })
    .notNull()
    .default("generic"),
  acceptingReports: integer("accepting_reports", { mode: "boolean" })
    .notNull()
    .default(true),
  acceptingScreenshots: integer("accepting_screenshots", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    email: text("email"),
    screenshotPath: text("screenshot_path"),
    pageUrl: text("page_url"),
    userAgent: text("user_agent"),
    status: text("status", { enum: feedbackStatus })
      .notNull()
      .default("new"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    check(
      "feedback_status_check",
      sql`${t.status} in ('new', 'read', 'archived')`,
    ),
    index("feedback_service_status_created_idx").on(
      t.serviceId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  feedbackId: integer("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  webhookUrl: text("webhook_url").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  responseStatus: integer("response_status"),
  error: text("error"),
  attemptedAt: integer("attempted_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
