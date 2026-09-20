CREATE TABLE `equipment_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(100),
	`serial` varchar(100),
	`status` enum('IN_STUDIO','ON_JOB','WITH_CREW','IN_REPAIR','RETIRED') NOT NULL DEFAULT 'IN_STUDIO',
	`notes` text,
	`job_id` int,
	`crew_contact_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipment_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `equipment_assets` ADD CONSTRAINT `equipment_assets_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `equipment_assets` ADD CONSTRAINT `equipment_assets_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `equipment_assets` ADD CONSTRAINT `equipment_assets_crew_contact_id_crew_contacts_id_fk` FOREIGN KEY (`crew_contact_id`) REFERENCES `crew_contacts`(`id`) ON DELETE set null ON UPDATE no action;