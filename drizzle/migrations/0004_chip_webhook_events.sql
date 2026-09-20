CREATE TABLE `chip_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` varchar(191) NOT NULL,
	`payload` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chip_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_webhook_events_event_id_uidx` UNIQUE(`event_id`)
);
