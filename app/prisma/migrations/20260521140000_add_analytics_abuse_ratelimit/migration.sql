-- CreateEnum
CREATE TYPE "visitor_class" AS ENUM ('HUMAN', 'SEARCH_BOT', 'AI_AGENT', 'OTHER_BOT');

-- CreateEnum
CREATE TYPE "ai_category" AS ENUM ('TRAINING_CRAWLER', 'SEARCH_INDEXER', 'LIVE_RETRIEVAL', 'UNKNOWN_SCRAPER');

-- CreateEnum
CREATE TYPE "abuse_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "enforcement_type" AS ENUM ('LOG_ONLY', 'THROTTLE', 'BLOCK');

-- CreateEnum
CREATE TYPE "access_rule_type" AS ENUM ('ALLOW', 'BLOCK');

-- CreateEnum
CREATE TYPE "access_actor_type" AS ENUM ('IP', 'SESSION', 'USER');

-- CreateTable
CREATE TABLE "traffic_events" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "route_pattern" VARCHAR(255) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "response_bytes" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT,
    "referrer_host" VARCHAR(255),
    "user_agent" TEXT,
    "browser" VARCHAR(60),
    "os" VARCHAR(60),
    "device_type" VARCHAR(20),
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "visitor_class" "visitor_class" NOT NULL DEFAULT 'HUMAN',
    "ai_provider" VARCHAR(60),
    "ai_category" "ai_category",
    "ai_verified" VARCHAR(20),
    "ip_hash" VARCHAR(64) NOT NULL,
    "ip_truncated" VARCHAR(45),
    "country" VARCHAR(2),
    "user_id" UUID,
    "user_role" VARCHAR(30),
    "session_id" VARCHAR(64),
    "visitor_id" VARCHAR(64),
    "is_new_visitor" BOOLEAN NOT NULL DEFAULT false,
    "is_new_session" BOOLEAN NOT NULL DEFAULT false,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_rollup_hourly" (
    "id" UUID NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "visitor_class" "visitor_class" NOT NULL,
    "ai_provider" VARCHAR(60) NOT NULL DEFAULT '-',
    "ai_category" VARCHAR(40) NOT NULL DEFAULT '-',
    "country" VARCHAR(8) NOT NULL DEFAULT '-',
    "route_pattern" VARCHAR(255) NOT NULL,
    "referrer_host" VARCHAR(255) NOT NULL DEFAULT '-',
    "device_type" VARCHAR(20) NOT NULL DEFAULT '-',
    "browser" VARCHAR(60) NOT NULL DEFAULT '-',
    "requests" INTEGER NOT NULL DEFAULT 0,
    "client_errors" INTEGER NOT NULL DEFAULT 0,
    "server_errors" INTEGER NOT NULL DEFAULT 0,
    "sum_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "max_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "p95_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "sum_bytes" BIGINT NOT NULL DEFAULT 0,
    "unique_visitors" INTEGER NOT NULL DEFAULT 0,
    "unique_sessions" INTEGER NOT NULL DEFAULT 0,
    "new_visitors" INTEGER NOT NULL DEFAULT 0,
    "new_sessions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_rollup_hourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_rollup_daily" (
    "id" UUID NOT NULL,
    "bucket" DATE NOT NULL,
    "visitor_class" "visitor_class" NOT NULL,
    "ai_provider" VARCHAR(60) NOT NULL DEFAULT '-',
    "ai_category" VARCHAR(40) NOT NULL DEFAULT '-',
    "country" VARCHAR(8) NOT NULL DEFAULT '-',
    "route_pattern" VARCHAR(255) NOT NULL,
    "referrer_host" VARCHAR(255) NOT NULL DEFAULT '-',
    "device_type" VARCHAR(20) NOT NULL DEFAULT '-',
    "browser" VARCHAR(60) NOT NULL DEFAULT '-',
    "requests" INTEGER NOT NULL DEFAULT 0,
    "client_errors" INTEGER NOT NULL DEFAULT 0,
    "server_errors" INTEGER NOT NULL DEFAULT 0,
    "sum_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "max_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "p95_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "sum_bytes" BIGINT NOT NULL DEFAULT 0,
    "unique_visitors" INTEGER NOT NULL DEFAULT 0,
    "unique_sessions" INTEGER NOT NULL DEFAULT 0,
    "new_visitors" INTEGER NOT NULL DEFAULT 0,
    "new_sessions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_rollup_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_events" (
    "id" UUID NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "access_actor_type" NOT NULL,
    "actor_key" VARCHAR(120) NOT NULL,
    "ip_hash" VARCHAR(64),
    "ip_truncated" VARCHAR(45),
    "user_id" UUID,
    "category" VARCHAR(60) NOT NULL,
    "severity" "abuse_severity" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB,
    "user_agent" TEXT,
    "path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enforcement_actions" (
    "id" UUID NOT NULL,
    "abuse_event_id" UUID,
    "actor_type" "access_actor_type" NOT NULL,
    "actor_key" VARCHAR(120) NOT NULL,
    "type" "enforcement_type" NOT NULL,
    "reason" TEXT NOT NULL,
    "applied_by_id" UUID,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enforcement_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actor_access_rules" (
    "id" UUID NOT NULL,
    "actor_type" "access_actor_type" NOT NULL,
    "actor_value" VARCHAR(120) NOT NULL,
    "rule_type" "access_rule_type" NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actor_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_events_occurred_at_idx" ON "traffic_events"("occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_visitor_class_occurred_at_idx" ON "traffic_events"("visitor_class", "occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_ai_provider_occurred_at_idx" ON "traffic_events"("ai_provider", "occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_ip_hash_occurred_at_idx" ON "traffic_events"("ip_hash", "occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_route_pattern_occurred_at_idx" ON "traffic_events"("route_pattern", "occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_status_code_occurred_at_idx" ON "traffic_events"("status_code", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "rollup_hourly_dims" ON "traffic_rollup_hourly"("bucket", "visitor_class", "ai_provider", "ai_category", "country", "route_pattern", "referrer_host", "device_type", "browser");

-- CreateIndex
CREATE INDEX "traffic_rollup_hourly_bucket_idx" ON "traffic_rollup_hourly"("bucket");

-- CreateIndex
CREATE INDEX "traffic_rollup_hourly_visitor_class_bucket_idx" ON "traffic_rollup_hourly"("visitor_class", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "rollup_daily_dims" ON "traffic_rollup_daily"("bucket", "visitor_class", "ai_provider", "ai_category", "country", "route_pattern", "referrer_host", "device_type", "browser");

-- CreateIndex
CREATE INDEX "traffic_rollup_daily_bucket_idx" ON "traffic_rollup_daily"("bucket");

-- CreateIndex
CREATE INDEX "traffic_rollup_daily_visitor_class_bucket_idx" ON "traffic_rollup_daily"("visitor_class", "bucket");

-- CreateIndex
CREATE INDEX "abuse_events_detected_at_idx" ON "abuse_events"("detected_at");

-- CreateIndex
CREATE INDEX "abuse_events_actor_type_actor_key_idx" ON "abuse_events"("actor_type", "actor_key");

-- CreateIndex
CREATE INDEX "abuse_events_category_detected_at_idx" ON "abuse_events"("category", "detected_at");

-- CreateIndex
CREATE INDEX "abuse_events_severity_detected_at_idx" ON "abuse_events"("severity", "detected_at");

-- CreateIndex
CREATE INDEX "enforcement_actions_actor_type_actor_key_idx" ON "enforcement_actions"("actor_type", "actor_key");

-- CreateIndex
CREATE INDEX "enforcement_actions_active_expires_at_idx" ON "enforcement_actions"("active", "expires_at");

-- CreateIndex
CREATE INDEX "enforcement_actions_created_at_idx" ON "enforcement_actions"("created_at");

-- CreateIndex
CREATE INDEX "actor_access_rules_active_idx" ON "actor_access_rules"("active");

-- CreateIndex
CREATE UNIQUE INDEX "actor_access_rules_actor_type_actor_value_rule_type_key" ON "actor_access_rules"("actor_type", "actor_value", "rule_type");

-- AddForeignKey
ALTER TABLE "enforcement_actions" ADD CONSTRAINT "enforcement_actions_abuse_event_id_fkey" FOREIGN KEY ("abuse_event_id") REFERENCES "abuse_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
