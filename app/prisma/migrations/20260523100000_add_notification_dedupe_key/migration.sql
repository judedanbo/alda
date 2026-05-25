-- Adds an optional natural dedupe key on notifications so the
-- service can skip duplicates (e.g. double-clicked actions, retried
-- handlers) within a short window without manual coordination.

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" VARCHAR(255);

CREATE INDEX "notifications_user_id_type_dedupe_key_created_at_idx"
    ON "notifications" ("user_id", "type", "dedupe_key", "created_at");
