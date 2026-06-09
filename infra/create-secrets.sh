#!/usr/bin/env bash
set -euo pipefail

# Creates the adla-secrets Secret for a namespace, generating strong values for
# every secret the app's production boot gate requires
# (app/server/utils/config-validation.ts) plus the credentials the in-cluster
# Postgres/Redis/MinIO StatefulSets are initialized with.
#
# Values are GENERATED ONCE here so DATABASE_URL/MINIO creds can never drift from
# what the data tier is initialized with. Override any value by exporting it
# before running (e.g. SMTP_PASS=... ./create-secrets.sh adla-staging).
#
# Usage: ./create-secrets.sh <namespace>   (e.g. adla-staging or adla-production)

NAMESPACE="${1:?Usage: $0 <namespace> (e.g. adla-staging or adla-production)}"

# Environment name = namespace minus the "adla-" prefix (staging | production).
ENVIRONMENT="${NAMESPACE#adla-}"

# Refuse to clobber an existing secret unless FORCE=1. Rotating POSTGRES_PASSWORD
# here would NOT change an already-initialized Postgres (it reads the password
# only on first PVC init) → the app would then fail to authenticate.
if kubectl get secret adla-secrets -n "$NAMESPACE" >/dev/null 2>&1 && [ "${FORCE:-0}" != "1" ]; then
  echo "ERROR: adla-secrets already exists in $NAMESPACE." >&2
  echo "Re-run with FORCE=1 to overwrite — but note rotating POSTGRES_PASSWORD" >&2
  echo "breaks the existing Postgres PVC unless you ALTER USER inside Postgres." >&2
  exit 1
fi

gen() { openssl rand -hex "${1:-32}"; }

# 6 random chars from [a-z0-9] (e.g. r5g0ud). Reads a fixed block from urandom so
# the pipe never closes early under `set -o pipefail`.
rand_suffix() { LC_ALL=C head -c 256 /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | cut -c1-6; }

# Boot-gate secrets (PII keys are 32 raw bytes => 64 hex chars)
JWT_SECRET="${JWT_SECRET:-$(gen 64)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(gen 64)}"
ANALYTICS_IP_SALT="${ANALYTICS_IP_SALT:-$(gen 32)}"
NOTIFICATIONS_SMS_WEBHOOK_SECRET="${NOTIFICATIONS_SMS_WEBHOOK_SECRET:-$(gen 32)}"
PII_ENCRYPTION_KEY="${PII_ENCRYPTION_KEY:-$(gen 32)}"
PII_HMAC_KEY="${PII_HMAC_KEY:-$(gen 32)}"

# MinIO creds — these double as the MinIO root user/password (projected into the
# StatefulSet via secretKeyRef), so they are the single source of truth.
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-adla$(gen 6)}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-$(gen 24)}"

# Postgres creds — initialize the in-cluster Postgres StatefulSet.
# User/DB carry the environment name; production additionally gets a random
# 6-char suffix on the DB (e.g. adla-production-r5g0ud).
POSTGRES_USER="${POSTGRES_USER:-adla-${ENVIRONMENT}}"
if [ "$ENVIRONMENT" = "production" ]; then
  POSTGRES_DB="${POSTGRES_DB:-adla-${ENVIRONMENT}-$(rand_suffix)}"
else
  POSTGRES_DB="${POSTGRES_DB:-adla-${ENVIRONMENT}}"
fi
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen 24)}"   # hex => URL-safe

# Connection URLs point at the in-cluster Service DNS names and are DERIVED from
# the generated credentials above so they always match.
DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@adla-postgres:5432/${POSTGRES_DB}?schema=public}"
REDIS_URL="${REDIS_URL:-redis://adla-redis:6379}"

# Optional SMTP creds (not boot-gated; leave blank to defer email).
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"

# Optional SMS provider credentials (not boot-gated; leave blank to defer SMS —
# the verify/notification flows then fail at send time in production until set).
# Read via process.env directly (notification-config.ts), so PLAIN names only —
# no NUXT_ twin. Non-secret SMS values (SMS_PROVIDER, *_SENDER_ID,
# SMS_TWILIO_FROM_NUMBER) live in ConfigMap adla-config, not here.
# Arkesel = primary for Ghana (+233); Hubtel = fallback; Twilio = international.
ARKESEL_API_KEY="${ARKESEL_API_KEY:-}"
HUBTEL_CLIENT_ID="${HUBTEL_CLIENT_ID:-}"
HUBTEL_CLIENT_SECRET="${HUBTEL_CLIENT_SECRET:-}"
SMS_TWILIO_ACCOUNT_SID="${SMS_TWILIO_ACCOUNT_SID:-}"
SMS_TWILIO_AUTH_TOKEN="${SMS_TWILIO_AUTH_TOKEN:-}"

# Optional bootstrap admin (consumed by prisma/bootstrap-admin.ts via the
# bootstrap-admin Job). Leave blank here and patch them in just before running
# `infra/seed.sh production bootstrap-admin`, or export them before this script.
BOOTSTRAP_ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-}"
BOOTSTRAP_ADMIN_PASSWORD="${BOOTSTRAP_ADMIN_PASSWORD:-}"

# Secrets are delivered under BOTH names on purpose:
#   * plain names  — read via process.env directly (Prisma's DATABASE_URL, the
#     production boot gate in config-validation.ts, REDIS_URL direct readers,
#     PII_* and the SMS webhook secret) and by the data-tier StatefulSets.
#   * NUXT_ copies — a production Nuxt build only overrides runtimeConfig from
#     NUXT_-prefixed env vars at runtime; the app reads JWT/MinIO/Redis/SMTP/IP-
#     salt via useRuntimeConfig(), so those each need a NUXT_ twin. (PII keys and
#     the webhook secret are read straight from process.env, so they need no twin.)
kubectl create secret generic adla-secrets \
  --namespace "$NAMESPACE" \
  --from-literal="DATABASE_URL=${DATABASE_URL}" \
  --from-literal="JWT_SECRET=${JWT_SECRET}" \
  --from-literal="JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}" \
  --from-literal="REDIS_URL=${REDIS_URL}" \
  --from-literal="MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}" \
  --from-literal="MINIO_SECRET_KEY=${MINIO_SECRET_KEY}" \
  --from-literal="POSTGRES_USER=${POSTGRES_USER}" \
  --from-literal="POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  --from-literal="POSTGRES_DB=${POSTGRES_DB}" \
  --from-literal="ANALYTICS_IP_SALT=${ANALYTICS_IP_SALT}" \
  --from-literal="NOTIFICATIONS_SMS_WEBHOOK_SECRET=${NOTIFICATIONS_SMS_WEBHOOK_SECRET}" \
  --from-literal="PII_ENCRYPTION_KEY=${PII_ENCRYPTION_KEY}" \
  --from-literal="PII_HMAC_KEY=${PII_HMAC_KEY}" \
  --from-literal="SMTP_USER=${SMTP_USER}" \
  --from-literal="SMTP_PASS=${SMTP_PASS}" \
  --from-literal="ARKESEL_API_KEY=${ARKESEL_API_KEY}" \
  --from-literal="HUBTEL_CLIENT_ID=${HUBTEL_CLIENT_ID}" \
  --from-literal="HUBTEL_CLIENT_SECRET=${HUBTEL_CLIENT_SECRET}" \
  --from-literal="SMS_TWILIO_ACCOUNT_SID=${SMS_TWILIO_ACCOUNT_SID}" \
  --from-literal="SMS_TWILIO_AUTH_TOKEN=${SMS_TWILIO_AUTH_TOKEN}" \
  --from-literal="BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL}" \
  --from-literal="BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD}" \
  --from-literal="NUXT_JWT_SECRET=${JWT_SECRET}" \
  --from-literal="NUXT_JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}" \
  --from-literal="NUXT_REDIS_URL=${REDIS_URL}" \
  --from-literal="NUXT_MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}" \
  --from-literal="NUXT_MINIO_SECRET_KEY=${MINIO_SECRET_KEY}" \
  --from-literal="NUXT_ANALYTICS_IP_SALT=${ANALYTICS_IP_SALT}" \
  --from-literal="NUXT_SMTP_USER=${SMTP_USER}" \
  --from-literal="NUXT_SMTP_PASS=${SMTP_PASS}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "==> Secret 'adla-secrets' created in namespace $NAMESPACE"
echo "    (values are stored only in the cluster; not printed here)"
echo ""
echo "SMTP_USER/SMTP_PASS are blank — add them later WITHOUT rotating other keys:"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"SMTP_USER\":\"...\",\"SMTP_PASS\":\"...\"}}'"
echo ""
echo "SMS provider creds are blank — phone verification/SMS stays deferred until set."
echo "Arkesel is primary (Ghana), Hubtel fallback, Twilio international. Add them with:"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"ARKESEL_API_KEY\":\"...\"}}'"
echo "  # optional: HUBTEL_CLIENT_ID/HUBTEL_CLIENT_SECRET (fallback),"
echo "  #           SMS_TWILIO_ACCOUNT_SID/SMS_TWILIO_AUTH_TOKEN (international)"
echo "  # non-secret SMS_PROVIDER/*_SENDER_ID/SMS_TWILIO_FROM_NUMBER are in adla-config"
echo ""
echo "BOOTSTRAP_ADMIN_EMAIL/PASSWORD are blank — set them before bootstrapping the"
echo "first admin (infra/seed.sh production bootstrap-admin):"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"BOOTSTRAP_ADMIN_EMAIL\":\"...\",\"BOOTSTRAP_ADMIN_PASSWORD\":\"...\"}}'"
