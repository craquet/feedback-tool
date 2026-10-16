CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_id` integer NOT NULL,
	`message` text NOT NULL,
	`email` text,
	`screenshot_path` text,
	`page_url` text,
	`user_agent` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "feedback_status_check" CHECK("feedback"."status" in ('new', 'read', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `feedback_service_status_created_idx` ON `feedback` (`service_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedback_id` integer NOT NULL,
	`webhook_url` text NOT NULL,
	`ok` integer NOT NULL,
	`response_status` integer,
	`error` text,
	`attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`embed_key` text NOT NULL,
	`webhook_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `services_embed_key_unique` ON `services` (`embed_key`);