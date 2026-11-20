-- Explicit rollback: removes only the new payment lifecycle telemetry table.
DROP TABLE IF EXISTS "payment_diagnostic_event";
