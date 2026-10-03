CREATE TABLE `channel_visits` (
	`user_id` text NOT NULL,
	`target_id` text NOT NULL,
	`platform` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_id`, `platform`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`shared` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`user_id`, `platform`)
);
--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`starts` text DEFAULT '' NOT NULL,
	`ends` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'recruiting' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`image` integer NOT NULL,
	`position` integer NOT NULL,
	`published` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`duration` integer NOT NULL,
	`position` integer NOT NULL,
	`video` text DEFAULT '' NOT NULL,
	`questions` text NOT NULL,
	`resource` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` text,
	`body` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`watched` real DEFAULT 0 NOT NULL,
	`complete` integer DEFAULT 0 NOT NULL,
	`score` integer,
	`bookmark` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`user_id`, `lesson_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);