CREATE TABLE `checklist_template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`phase` enum('BEFORE','ON_DAY','AFTER') NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklist_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(32),
	`email` varchar(255),
	`nric_or_ssm` varchar(64),
	`tin` varchar(64),
	`social_handle` varchar(120),
	`address` text,
	`whatsapp_consent` boolean NOT NULL DEFAULT false,
	`retired_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contract_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crew_contact_crafts` (
	`crew_contact_id` int NOT NULL,
	`option_item_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crew_contact_crafts_crew_contact_id_option_item_id_pk` PRIMARY KEY(`crew_contact_id`,`option_item_id`)
);
--> statement-breakpoint
CREATE TABLE `crew_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(32),
	`email` varchar(255),
	`user_id` int,
	`retired_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crew_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`phase` enum('BEFORE','ON_DAY','AFTER') NOT NULL,
	`done_at` timestamp,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`status` enum('DRAFT','SENT','SIGNED') NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_deliverables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('PENDING','IN_PROGRESS','DELIVERED') NOT NULL DEFAULT 'PENDING',
	`client_visible` boolean NOT NULL DEFAULT false,
	`url` varchar(512),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_deliverables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`ceremony_type_item_id` int,
	`label` varchar(200),
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp,
	`venue` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`client_id` int NOT NULL,
	`quotation_id` int,
	`number` varchar(64),
	`status` enum('CONFIRMED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
	`job_type_item_id` int,
	`lead_source_item_id` int,
	`cancel_reason_item_id` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_crew` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`studio_member_id` int,
	`crew_contact_id` int,
	`crew_role_item_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_crew_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_templates_studio_type_uidx` UNIQUE(`studio_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`type` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_templates_studio_type_uidx` UNIQUE(`studio_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`job_id` int,
	`amount` decimal(12,2) NOT NULL,
	`category_item_id` int,
	`tax_bucket` enum('CLAIMABLE','EQUIPMENT','NOT_CLAIMABLE','DRAWING') NOT NULL DEFAULT 'CLAIMABLE',
	`spent_at` timestamp NOT NULL,
	`receipt_url` varchar(512),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`label` varchar(200) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`due_date` timestamp,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`job_id` int NOT NULL,
	`number` varchar(64),
	`status` enum('DRAFT','SENT','PAID','VOID') NOT NULL DEFAULT 'DRAFT',
	`notes` text,
	`template_id` varchar(32) NOT NULL DEFAULT 'BASIC',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `other_income` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`category_item_id` int,
	`counts_toward_profit` boolean NOT NULL DEFAULT true,
	`received_at` timestamp NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `other_income_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_drawings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`drawn_at` timestamp NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_drawings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`job_id` int,
	`milestone_id` int,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('PAID','UNPAID','WRITTEN_OFF') NOT NULL DEFAULT 'UNPAID',
	`paid_at` timestamp,
	`pay_method_item_id` int,
	`bank_item_id` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `option_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`list_id` int NOT NULL,
	`label` varchar(200) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`retired_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `option_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `option_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`key` enum('CEREMONY_TYPE','JOB_TYPE','LEAD_SOURCE','PAY_METHOD','EXPENSE_CAT','INCOME_CAT','CANCEL_REASON','BANK','CREW_ROLE','CRAFT','EQUIP_LOCATION') NOT NULL,
	`seeded` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `option_lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `option_lists_studio_key_uidx` UNIQUE(`studio_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`price` decimal(12,2) NOT NULL DEFAULT '0',
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_plan_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plan_id` int NOT NULL,
	`label` varchar(200) NOT NULL,
	`type` enum('FIXED','PCT_TOTAL','PCT_REMAINING') NOT NULL,
	`value` decimal(12,2) NOT NULL DEFAULT '0',
	`due_n` int NOT NULL DEFAULT 0,
	`due_unit` enum('DAYS','WEEKS','MONTHS') NOT NULL DEFAULT 'DAYS',
	`due_anchor` enum('TODAY','BEFORE_SHOOT','AFTER_SHOOT') NOT NULL DEFAULT 'TODAY',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_plan_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_plan_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_plan_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`job_id` int NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_tokens_token_hash_uidx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `pricing_opex` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_opex_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_saved_calcs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`sell_price` decimal(12,2) NOT NULL DEFAULT '0',
	`direct_cost` decimal(12,2) NOT NULL DEFAULT '0',
	`verdict` varchar(32),
	`notes` text,
	`package_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_saved_calcs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`jobs_per_month` int NOT NULL DEFAULT 0,
	`avg_price` decimal(12,2) NOT NULL DEFAULT '0',
	`profit_goal` decimal(12,2) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotation_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`package_id` int,
	`name` varchar(200) NOT NULL,
	`description` text,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit_price` decimal(12,2) NOT NULL DEFAULT '0',
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotation_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_payment_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`label` varchar(200) NOT NULL,
	`type` enum('FIXED','PCT_TOTAL','PCT_REMAINING') NOT NULL,
	`value` decimal(12,2) NOT NULL DEFAULT '0',
	`due_n` int NOT NULL DEFAULT 0,
	`due_unit` enum('DAYS','WEEKS','MONTHS') NOT NULL DEFAULT 'DAYS',
	`due_anchor` enum('TODAY','BEFORE_SHOOT','AFTER_SHOOT') NOT NULL DEFAULT 'TODAY',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotation_payment_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`ceremony_type_item_id` int,
	`label` varchar(200),
	`starts_at` timestamp,
	`ends_at` timestamp,
	`venue` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotation_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`client_id` int NOT NULL,
	`number` varchar(64),
	`status` enum('DRAFT','SENT','ACCEPTED','LOST') NOT NULL DEFAULT 'DRAFT',
	`currency` varchar(8) NOT NULL DEFAULT 'MYR',
	`intro` text,
	`notes` text,
	`total_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`public_token` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`days` int NOT NULL DEFAULT 0,
	`dir` enum('before','after','on') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminder_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studio_member_crafts` (
	`studio_member_id` int NOT NULL,
	`option_item_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studio_member_crafts_studio_member_id_option_item_id_pk` PRIMARY KEY(`studio_member_id`,`option_item_id`)
);
--> statement-breakpoint
CREATE TABLE `studio_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`user_id` int NOT NULL,
	`access` enum('OWNER','ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studio_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `studio_members_studio_user_uidx` UNIQUE(`studio_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`ssm` varchar(64),
	`tin` varchar(64),
	`address` text,
	`phone` varchar(32),
	`email` varchar(255),
	`biz_type` enum('SOLE_PROP','SDN_BHD'),
	`logo_url` varchar(512),
	`pay_to_bank` varchar(100),
	`pay_to_account_name` varchar(200),
	`pay_to_account_no` varchar(64),
	`portal_message` text,
	`currency` varchar(8) NOT NULL DEFAULT 'MYR',
	`working_days` json NOT NULL,
	`capacity_per_day` int NOT NULL DEFAULT 2,
	`invoice_template_id` varchar(32) NOT NULL DEFAULT 'BASIC',
	`quote_next_number` int NOT NULL DEFAULT 1,
	`invoice_next_number` int NOT NULL DEFAULT 1,
	`quote_intro` text,
	`quote_notes` text,
	`invoice_notes` text,
	`chip_enabled` boolean NOT NULL DEFAULT false,
	`payment_reminders_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_oauth_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`provider` enum('GOOGLE') NOT NULL,
	`provider_email` varchar(255),
	`access_token_enc` text,
	`refresh_token_enc` text,
	`scopes` text,
	`calendar_sync_enabled` boolean NOT NULL DEFAULT false,
	`drive_receipts_enabled` boolean NOT NULL DEFAULT false,
	`footage_portal_enabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_oauth_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_oauth_user_provider_uidx` UNIQUE(`user_id`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`refresh_token_hash` varchar(128) NOT NULL,
	`user_agent` varchar(512),
	`ip_address` varchar(64),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `wa_updates_opt_in` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `my_bills_reminders_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `my_bills_days_before` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `checklist_template_items` ADD CONSTRAINT `checklist_template_items_template_id_checklist_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD CONSTRAINT `checklist_templates_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contract_templates` ADD CONSTRAINT `contract_templates_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crew_contact_crafts` ADD CONSTRAINT `crew_contact_crafts_crew_contact_id_crew_contacts_id_fk` FOREIGN KEY (`crew_contact_id`) REFERENCES `crew_contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crew_contact_crafts` ADD CONSTRAINT `crew_contact_crafts_option_item_id_option_items_id_fk` FOREIGN KEY (`option_item_id`) REFERENCES `option_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crew_contacts` ADD CONSTRAINT `crew_contacts_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crew_contacts` ADD CONSTRAINT `crew_contacts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_checklist_items` ADD CONSTRAINT `job_checklist_items_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_contracts` ADD CONSTRAINT `job_contracts_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_deliverables` ADD CONSTRAINT `job_deliverables_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_sessions` ADD CONSTRAINT `job_sessions_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_quotation_id_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_crew` ADD CONSTRAINT `session_crew_session_id_job_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `job_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_crew` ADD CONSTRAINT `session_crew_studio_member_id_studio_members_id_fk` FOREIGN KEY (`studio_member_id`) REFERENCES `studio_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_crew` ADD CONSTRAINT `session_crew_crew_contact_id_crew_contacts_id_fk` FOREIGN KEY (`crew_contact_id`) REFERENCES `crew_contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_templates` ADD CONSTRAINT `whatsapp_templates_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_milestones` ADD CONSTRAINT `invoice_milestones_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `other_income` ADD CONSTRAINT `other_income_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_drawings` ADD CONSTRAINT `owner_drawings_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_milestone_id_invoice_milestones_id_fk` FOREIGN KEY (`milestone_id`) REFERENCES `invoice_milestones`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `option_items` ADD CONSTRAINT `option_items_list_id_option_lists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `option_lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `option_lists` ADD CONSTRAINT `option_lists_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_plan_milestones` ADD CONSTRAINT `payment_plan_milestones_plan_id_payment_plan_templates_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `payment_plan_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_plan_templates` ADD CONSTRAINT `payment_plan_templates_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_tokens` ADD CONSTRAINT `portal_tokens_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_tokens` ADD CONSTRAINT `portal_tokens_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_opex` ADD CONSTRAINT `pricing_opex_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_saved_calcs` ADD CONSTRAINT `pricing_saved_calcs_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricing_targets` ADD CONSTRAINT `pricing_targets_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotation_contracts` ADD CONSTRAINT `quotation_contracts_quotation_id_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotation_line_items` ADD CONSTRAINT `quotation_line_items_quotation_id_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotation_payment_rows` ADD CONSTRAINT `quotation_payment_rows_quotation_id_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotation_sessions` ADD CONSTRAINT `quotation_sessions_quotation_id_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminder_rules` ADD CONSTRAINT `reminder_rules_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studio_member_crafts` ADD CONSTRAINT `studio_member_crafts_studio_member_id_studio_members_id_fk` FOREIGN KEY (`studio_member_id`) REFERENCES `studio_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studio_member_crafts` ADD CONSTRAINT `studio_member_crafts_option_item_id_option_items_id_fk` FOREIGN KEY (`option_item_id`) REFERENCES `option_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studio_members` ADD CONSTRAINT `studio_members_studio_id_studios_id_fk` FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studio_members` ADD CONSTRAINT `studio_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_oauth_connections` ADD CONSTRAINT `user_oauth_connections_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;