-- CreateTable
CREATE TABLE "accessibility_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text_size" VARCHAR(16) NOT NULL DEFAULT 'base',
    "reduce_motion" BOOLEAN NOT NULL DEFAULT false,
    "underline_links" BOOLEAN NOT NULL DEFAULT false,
    "readable_font" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_preferences_user_id_key" ON "accessibility_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "accessibility_preferences" ADD CONSTRAINT "accessibility_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
