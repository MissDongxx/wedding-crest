-- Only PII-free lifecycle metadata; no payment/card/provider bodies.
CREATE TABLE IF NOT EXISTS `payment_diagnostic_event` (
  `id` varchar(191) PRIMARY KEY NOT NULL,
  `source` varchar(191) NOT NULL,
  `stage` varchar(191) NOT NULL,
  `reason` varchar(191),
  `request_id` varchar(191),
  `attempt_id` varchar(191),
  `order_no` varchar(191),
  `provider` varchar(191),
  `owner_id` varchar(191),
  `project_id` varchar(191),
  `entry` varchar(191),
  `http_status` integer,
  `latency_ms` integer,
  `details` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_payment_diag_order_created` ON `payment_diagnostic_event` (`order_no`, `created_at`);
CREATE INDEX `idx_payment_diag_attempt_created` ON `payment_diagnostic_event` (`attempt_id`, `created_at`);
CREATE INDEX `idx_payment_diag_owner_created` ON `payment_diagnostic_event` (`owner_id`, `created_at`);
CREATE INDEX `idx_payment_diag_created` ON `payment_diagnostic_event` (`created_at`);
