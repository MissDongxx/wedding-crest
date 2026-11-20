-- Only PII-free lifecycle metadata; no payment/card/provider bodies.
CREATE TABLE IF NOT EXISTS "wedding-crest"."payment_diagnostic_event" (
  "id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "stage" text NOT NULL,
  "reason" text,
  "request_id" text,
  "attempt_id" text,
  "order_no" text,
  "provider" text,
  "owner_id" text,
  "project_id" text,
  "entry" text,
  "http_status" integer,
  "latency_ms" integer,
  "details" text,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_payment_diag_order_created" ON "wedding-crest"."payment_diagnostic_event" ("order_no", "created_at");
CREATE INDEX IF NOT EXISTS "idx_payment_diag_attempt_created" ON "wedding-crest"."payment_diagnostic_event" ("attempt_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_payment_diag_owner_created" ON "wedding-crest"."payment_diagnostic_event" ("owner_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_payment_diag_created" ON "wedding-crest"."payment_diagnostic_event" ("created_at");
