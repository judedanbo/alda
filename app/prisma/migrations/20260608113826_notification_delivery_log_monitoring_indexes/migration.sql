-- DropForeignKey
ALTER TABLE "phone_verification_tokens" DROP CONSTRAINT "phone_verification_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_collection_offices" DROP CONSTRAINT "user_collection_offices_collection_office_id_fkey";

-- DropForeignKey
ALTER TABLE "user_collection_offices" DROP CONSTRAINT "user_collection_offices_user_id_fkey";

-- AlterTable
ALTER TABLE "phone_verification_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "notification_delivery_logs_created_at_idx" ON "notification_delivery_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_status_created_at_idx" ON "notification_delivery_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_channel_created_at_idx" ON "notification_delivery_logs"("channel", "created_at");

-- AddForeignKey
ALTER TABLE "phone_verification_tokens" ADD CONSTRAINT "phone_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_offices" ADD CONSTRAINT "user_collection_offices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_offices" ADD CONSTRAINT "user_collection_offices_collection_office_id_fkey" FOREIGN KEY ("collection_office_id") REFERENCES "collection_offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "applicant_profiles_alt_id_hash_key" RENAME TO "applicant_profiles_id_type_alternate_id_number_hash_key";

-- RenameIndex
ALTER INDEX "rollup_daily_dims" RENAME TO "traffic_rollup_daily_bucket_visitor_class_ai_provider_ai_ca_key";

-- RenameIndex
ALTER INDEX "rollup_hourly_dims" RENAME TO "traffic_rollup_hourly_bucket_visitor_class_ai_provider_ai_c_key";
