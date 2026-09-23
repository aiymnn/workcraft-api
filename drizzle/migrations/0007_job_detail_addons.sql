CREATE TABLE `job_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`channel` enum('EMAIL','WHATSAPP','NOTE') NOT NULL,
	`kind` varchar(64) NOT NULL,
	`subject` varchar(255),
	`summary` text,
	`invoice_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quotations` ADD `job_id` int;--> statement-breakpoint
ALTER TABLE `job_activity` ADD CONSTRAINT `job_activity_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_activity` ADD CONSTRAINT `job_activity_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;