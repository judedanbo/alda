#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED — companion to provision.sh. The standard deployment uses in-cluster
# StatefulSets, not Azure managed services, so there is normally nothing here to
# tear down. Kept for reference / optional fallback only.

# Deletes ADLA managed services individually (safe for shared resource groups).

RESOURCE_GROUP="${RESOURCE_GROUP:-infosys}"

echo "WARNING: This will delete the following ADLA resources in '$RESOURCE_GROUP':"
echo "  - adla-pg-staging       (PostgreSQL Flexible Server)"
echo "  - adla-pg-production    (PostgreSQL Flexible Server)"
echo "  - adla-redis-staging    (Azure Cache for Redis)"
echo "  - adla-redis-production (Azure Cache for Redis)"
echo "  - adlastoragestaging    (Storage Account)"
echo "  - adlastorageprod       (Storage Account)"
echo ""
echo "Press Ctrl+C within 10 seconds to abort."
sleep 10

echo "==> Deleting PostgreSQL staging"
az postgres flexible-server delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-staging \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo "==> Deleting PostgreSQL production"
az postgres flexible-server delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-production \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo "==> Deleting Redis staging"
az redis delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo "==> Deleting Redis production"
az redis delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo "==> Deleting storage account: staging"
az storage account delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adlastoragestaging \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo "==> Deleting storage account: production"
az storage account delete \
  --resource-group "$RESOURCE_GROUP" \
  --name adlastorageprod \
  --yes \
  --output none || echo "  (not found or already deleted)"

echo ""
echo "==> ADLA managed services deleted."
echo ""
echo "Note: K8s secrets and namespaces remain in the cluster."
echo "To clean those up manually:"
echo "  kubectl delete namespace adla-staging"
echo "  kubectl delete namespace adla-production"
