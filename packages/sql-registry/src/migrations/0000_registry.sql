CREATE TABLE `registry` (
	`session_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_harness` text NOT NULL,
	`parent_session_id` text NOT NULL,
	`status` text,
	`last_stopped` integer,
	`preview_port` integer,
	`preview_token` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registry_preview_token_unique` ON `registry` (`preview_token`);--> statement-breakpoint
CREATE INDEX `registry_parent_index` ON `registry` (`parent_harness`,`parent_session_id`);--> statement-breakpoint
CREATE INDEX `registry_last_stopped_index` ON `registry` (`last_stopped`);