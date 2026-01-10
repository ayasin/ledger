CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`parent_id` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_code_unique` ON `accounts` (`code`);--> statement-breakpoint
CREATE INDEX `accounts_type_idx` ON `accounts` (`type`);--> statement-breakpoint
CREATE INDEX `accounts_status_idx` ON `accounts` (`status`);--> statement-breakpoint
CREATE INDEX `accounts_parent_id_idx` ON `accounts` (`parent_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`filename` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_transaction_id_idx` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text,
	`parent_id` integer,
	`color` text,
	`budget_amount` real,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `categories_type_idx` ON `categories` (`type`);--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `transaction_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`category_id` integer,
	`description` text,
	`debit` real DEFAULT 0 NOT NULL,
	`credit` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transaction_lines_transaction_id_idx` ON `transaction_lines` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_lines_account_id_idx` ON `transaction_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `transaction_lines_category_id_idx` ON `transaction_lines` (`category_id`);--> statement-breakpoint
CREATE TABLE `transaction_tags` (
	`transaction_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transaction_tags_transaction_id_idx` ON `transaction_tags` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_tags_tag_id_idx` ON `transaction_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_date` integer NOT NULL,
	`posting_date` integer,
	`reference` text,
	`memo` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_transaction_date_idx` ON `transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `transactions_reference_idx` ON `transactions` (`reference`);