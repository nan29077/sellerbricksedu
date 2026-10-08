CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`cohort_id` text,
	`pinned` integer DEFAULT 0 NOT NULL,
	`author_id` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 1 NOT NULL,
	`published` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`issued` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_days` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`seconds` real DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `lesson_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`at` real DEFAULT 0 NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`provider`, `provider_id`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `question_votes` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`user_id`, `course_id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`score` integer,
	`created` text NOT NULL,
	`reviewed` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `level` text DEFAULT '입문' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `objectives` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `instructor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `section` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `chapters` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `objectives` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `preview` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `public` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `resolved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `progress` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `progress` ADD `best_score` integer;--> statement-breakpoint
ALTER TABLE `progress` ADD `completed_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `weekly_goal` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `bio` text DEFAULT '' NOT NULL;