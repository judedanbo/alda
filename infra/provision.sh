#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED — the deployment now runs Postgres, Redis, and MinIO IN-CLUSTER as
# StatefulSets (see k8s/base/statefulset-*.yaml). This script provisions Azure
# managed PostgreSQL/Redis/Blob, which the current architecture does NOT use.
# Kept for reference / optional fallback only. Do not run for the standard deploy.

# Provisions ADLA managed services into an existing resource group.
# Prerequisites: az CLI logged in, existing AKS cluster + ACR + VNet.

RESOURCE_GROUP="${RESOURCE_GROUP:-infosys}"
LOCATION="${LOCATION:-southafricanorth}"

echo "==> Provisioning ADLA managed services in resource group: $RESOURCE_GROUP"
echo ""

# ── PostgreSQL (staging) ───────────────────────────────────────
echo "==> Creating PostgreSQL staging server"
PG_STAGING_PASS=$(openssl rand -base64 32)
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-staging \
  --location "$LOCATION" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --admin-user adla \
  --admin-password "$PG_STAGING_PASS" \
  --yes \
  --output none

az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name adla-pg-staging \
  --database-name adla \
  --output none

# ── PostgreSQL (production) ────────────────────────────────────
echo "==> Creating PostgreSQL production server"
PG_PROD_PASS=$(openssl rand -base64 32)
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-production \
  --location "$LOCATION" \
  --sku-name Standard_D2ds_v4 \
  --tier GeneralPurpose \
  --version 16 \
  --storage-size 128 \
  --admin-user adla \
  --admin-password "$PG_PROD_PASS" \
  --high-availability ZoneRedundant \
  --backup-retention 35 \
  --geo-redundant-backup Enabled \
  --yes \
  --output none

az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name adla-pg-production \
  --database-name adla \
  --output none

# ── Redis (staging) ────────────────────────────────────────────
echo "==> Creating Redis staging"
az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size C0 \
  --output none

# ── Redis (production) ─────────────────────────────────────────
echo "==> Creating Redis production"
az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --location "$LOCATION" \
  --sku Standard \
  --vm-size C1 \
  --output none

# ── Blob Storage (staging) ─────────────────────────────────────
echo "==> Creating storage account: staging"
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name adlastoragestaging \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none

az storage container create \
  --account-name adlastoragestaging \
  --name adla-uploads \
  --auth-mode login \
  --output none

# ── Blob Storage (production) ──────────────────────────────────
echo "==> Creating storage account: production"
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name adlastorageprod \
  --location "$LOCATION" \
  --sku Standard_ZRS \
  --kind StorageV2 \
  --output none

az storage container create \
  --account-name adlastorageprod \
  --name adla-uploads \
  --auth-mode login \
  --output none

# ── Collect connection details ─────────────────────────────────
echo ""
echo "==> Fetching connection details..."

PG_STAGING_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-staging \
  --query fullyQualifiedDomainName -o tsv)

PG_PROD_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-production \
  --query fullyQualifiedDomainName -o tsv)

REDIS_STAGING_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --query primaryKey -o tsv)
REDIS_STAGING_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --query hostName -o tsv)

REDIS_PROD_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --query primaryKey -o tsv)
REDIS_PROD_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --query hostName -o tsv)

STORAGE_STAGING_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name adlastoragestaging \
  --query "[0].value" -o tsv)

STORAGE_PROD_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name adlastorageprod \
  --query "[0].value" -o tsv)

# ── Write credentials to a secure temp file ───────────────────
CREDS_FILE=$(mktemp /tmp/adla-credentials-XXXXXX.txt)
chmod 600 "$CREDS_FILE"

cat > "$CREDS_FILE" <<CREDS
══════════════════════════════════════════════════
  ADLA Managed Services — Credentials
  $(date -u +"%Y-%m-%d %H:%M:%S UTC")
══════════════════════════════════════════════════

── STAGING ────────────────────────────────────
DATABASE_URL:       postgresql://adla:${PG_STAGING_PASS}@${PG_STAGING_HOST}:5432/adla?schema=public&sslmode=require
REDIS_URL:          rediss://:${REDIS_STAGING_KEY}@${REDIS_STAGING_HOST}:6380
MINIO_ACCESS_KEY:   adlastoragestaging
MINIO_SECRET_KEY:   ${STORAGE_STAGING_KEY}

── PRODUCTION ─────────────────────────────────
DATABASE_URL:       postgresql://adla:${PG_PROD_PASS}@${PG_PROD_HOST}:5432/adla?schema=public&sslmode=require
REDIS_URL:          rediss://:${REDIS_PROD_KEY}@${REDIS_PROD_HOST}:6380
MINIO_ACCESS_KEY:   adlastorageprod
MINIO_SECRET_KEY:   ${STORAGE_PROD_KEY}

── BOTH ENVIRONMENTS (pre-generated) ──────────
JWT_SECRET:         $(openssl rand -base64 48)
JWT_REFRESH_SECRET: $(openssl rand -base64 48)
ANALYTICS_IP_SALT:  $(openssl rand -hex 32)
SMTP_PASS:          <your SMTP password>
SMTP_USER:          <your SMTP username>
CREDS

echo ""
echo "==> Provisioning complete!"
echo ""
echo "Credentials written to: $CREDS_FILE  (mode 600, owner-only)"
echo ""
echo "  View:   cat $CREDS_FILE"
echo "  Delete: rm $CREDS_FILE"
echo ""
echo "Next steps:"
echo "  1. Run: ./infra/create-secrets.sh adla-staging"
echo "  2. Run: ./infra/create-secrets.sh adla-production"
echo "  3. Paste values from $CREDS_FILE when prompted"
echo "  4. Update k8s/overlays/*/configmap-patch.yaml with MINIO_ENDPOINT and SMTP_HOST"
echo "  5. Set up GitHub OIDC: ./infra/setup-github-oidc.sh"
echo "  6. DELETE $CREDS_FILE after secrets are created"
