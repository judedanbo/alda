-- CreateEnum
CREATE TYPE "fuzzing_category" AS ENUM ('SUSPICIOUS_PATH', 'AUTH_FUZZING', 'FORM_VALIDATION', 'PARAM_TAMPERING', 'PATH_PROBE');

-- CreateTable
CREATE TABLE "fuzzing_attempts" (
    "id" UUID NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "fuzzing_category" NOT NULL,
    "severity" "abuse_severity" NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "route_pattern" VARCHAR(255) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "ip_hash" VARCHAR(64) NOT NULL,
    "ip_truncated" VARCHAR(45),
    "country" VARCHAR(2),
    "user_agent" TEXT,
    "visitor_class" "visitor_class" NOT NULL DEFAULT 'HUMAN',
    "user_id" UUID,
    "user_role" VARCHAR(30),
    "session_id" VARCHAR(64),
    "visitor_id" VARCHAR(64),
    "request_id" VARCHAR(64),
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuzzing_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuzzing_attempts_detected_at_idx" ON "fuzzing_attempts"("detected_at");

-- CreateIndex
CREATE INDEX "fuzzing_attempts_category_detected_at_idx" ON "fuzzing_attempts"("category", "detected_at");

-- CreateIndex
CREATE INDEX "fuzzing_attempts_severity_detected_at_idx" ON "fuzzing_attempts"("severity", "detected_at");

-- CreateIndex
CREATE INDEX "fuzzing_attempts_ip_hash_idx" ON "fuzzing_attempts"("ip_hash");
