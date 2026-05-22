-- AlterEnum
-- New delivery status for emails batched into the periodic digest.
ALTER TYPE "delivery_status" ADD VALUE IF NOT EXISTS 'QUEUED' AFTER 'PENDING';

-- Reset per-type notification preferences so the new catalog defaults
-- (reduced SMS, digest-batched low-priority email) apply to all users.
-- Global notification_preferences rows (the master channel switches) are kept.
DELETE FROM "notification_type_preferences";
