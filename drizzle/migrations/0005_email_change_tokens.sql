CREATE TABLE `email_change_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`new_email` varchar(255) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_change_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_change_tokens` ADD CONSTRAINT `email_change_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;