CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar` integer NOT NULL,
	`name_changes` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO user_profiles (user_id,avatar,name_changes) SELECT id,abs(random() % 30),0 FROM users;
