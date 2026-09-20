ALTER TABLE `quotations` ADD `accepted_at` timestamp;--> statement-breakpoint
ALTER TABLE `quotations` ADD `accepted_via` enum('STAFF','PUBLIC');--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_quotation_id_uidx` UNIQUE(`quotation_id`);