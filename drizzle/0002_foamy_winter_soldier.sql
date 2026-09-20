ALTER TABLE `users` ADD `notifications_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_lead_minutes` integer DEFAULT 15 NOT NULL;