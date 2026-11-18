CREATE TABLE `actors` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`age_range` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`portrait_key` text NOT NULL,
	`portrait_type` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `actors_owner_idx` ON `actors` (`owner_id`);--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`batch_id` text,
	`hook` text,
	`title` text NOT NULL,
	`script` text NOT NULL,
	`script_language` text NOT NULL,
	`language` text NOT NULL,
	`translated_script` text,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`voice` text NOT NULL,
	`direction` text DEFAULT '' NOT NULL,
	`aspect_ratio` text NOT NULL,
	`status` text NOT NULL,
	`step` text,
	`prediction_id` text,
	`hook_token_hash` text,
	`error` text,
	`video_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ads_user_idx` ON `ads` (`user_id`);--> statement-breakpoint
CREATE INDEX `ads_batch_idx` ON `ads` (`batch_id`);--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `batches_user_idx` ON `batches` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
