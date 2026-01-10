ALTER TABLE `transaction_lines` ADD `original_amount` real;--> statement-breakpoint
ALTER TABLE `transaction_lines` ADD `original_currency` text;--> statement-breakpoint
ALTER TABLE `transaction_lines` ADD `exchange_rate` real DEFAULT 1;