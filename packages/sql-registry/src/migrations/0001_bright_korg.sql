ALTER TABLE `registry` ADD `settings` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `registry` ADD `skill_names` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `registry` ADD `agent_names` text DEFAULT '[]' NOT NULL;