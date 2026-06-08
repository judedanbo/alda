-- CreateTable
CREATE TABLE "notification_credentials" (
    "key" VARCHAR(64) NOT NULL,
    "value_cipher" TEXT NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_credentials_pkey" PRIMARY KEY ("key")
);
