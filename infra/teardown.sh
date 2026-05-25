#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-adla-rg}"

echo "WARNING: This will delete ALL resources in resource group '$RESOURCE_GROUP'."
echo "Press Ctrl+C within 10 seconds to abort."
sleep 10

echo "==> Deleting resource group: $RESOURCE_GROUP"
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo "==> Deletion initiated (runs in background). Monitor in Azure Portal."
