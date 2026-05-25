#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
RESOURCE_GROUP="${RESOURCE_GROUP:-adla-rg}"
LOCATION="${LOCATION:-southafricanorth}"
AKS_CLUSTER="${AKS_CLUSTER:-adla-aks}"
ACR_NAME="${ACR_NAME:-adlaacr}"
VNET_NAME="${VNET_NAME:-adla-vnet}"

# ── Resource Group ─────────────────────────────────────────────
echo "==> Creating resource group: $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# ── VNet + Subnets ─────────────────────────────────────────────
echo "==> Creating VNet: $VNET_NAME"
az network vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VNET_NAME" \
  --address-prefix "10.0.0.0/16" \
  --output none

echo "==> Creating subnets"
az network vnet subnet create \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name aks-subnet \
  --address-prefix "10.0.0.0/22" \
  --output none

az network vnet subnet create \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name pg-subnet \
  --address-prefix "10.0.4.0/24" \
  --output none

az network vnet subnet create \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name redis-subnet \
  --address-prefix "10.0.5.0/24" \
  --output none

az network vnet subnet create \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name storage-subnet \
  --address-prefix "10.0.6.0/24" \
  --output none

AKS_SUBNET_ID=$(az network vnet subnet show \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name aks-subnet \
  --query id -o tsv)

# ── ACR ────────────────────────────────────────────────────────
echo "==> Creating ACR: $ACR_NAME"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --output none

# ── AKS ────────────────────────────────────────────────────────
echo "==> Creating AKS cluster: $AKS_CLUSTER"
az aks create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --location "$LOCATION" \
  --node-count 2 \
  --min-count 2 \
  --max-count 4 \
  --enable-cluster-autoscaler \
  --node-vm-size Standard_D2s_v3 \
  --network-plugin azure \
  --network-plugin-mode overlay \
  --vnet-subnet-id "$AKS_SUBNET_ID" \
  --enable-managed-identity \
  --attach-acr "$ACR_NAME" \
  --enable-addons monitoring \
  --enable-secret-store-csi-driver \
  --tier standard \
  --generate-ssh-keys \
  --output none

echo "==> Getting AKS credentials"
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --overwrite-existing

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

# ── Key Vault (staging) ────────────────────────────────────────
echo "==> Creating Key Vault: staging"
az keyvault create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-staging-kv \
  --location "$LOCATION" \
  --output none

PG_STAGING_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-staging \
  --query fullyQualifiedDomainName -o tsv)

az keyvault secret set --vault-name adla-staging-kv \
  --name db-connection-string \
  --value "postgresql://adla:${PG_STAGING_PASS}@${PG_STAGING_HOST}:5432/adla?schema=public&sslmode=require" \
  --output none

az keyvault secret set --vault-name adla-staging-kv \
  --name jwt-secret \
  --value "$(openssl rand -base64 48)" \
  --output none

az keyvault secret set --vault-name adla-staging-kv \
  --name jwt-refresh-secret \
  --value "$(openssl rand -base64 48)" \
  --output none

REDIS_STAGING_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --query primaryKey -o tsv)
REDIS_STAGING_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-staging \
  --query hostName -o tsv)

az keyvault secret set --vault-name adla-staging-kv \
  --name redis-connection-string \
  --value "rediss://:${REDIS_STAGING_KEY}@${REDIS_STAGING_HOST}:6380" \
  --output none

STORAGE_STAGING_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name adlastoragestaging \
  --query "[0].value" -o tsv)

az keyvault secret set --vault-name adla-staging-kv \
  --name storage-access-key \
  --value "$STORAGE_STAGING_KEY" \
  --output none

az keyvault secret set --vault-name adla-staging-kv \
  --name storage-secret-key \
  --value "$STORAGE_STAGING_KEY" \
  --output none

az keyvault secret set --vault-name adla-staging-kv \
  --name smtp-password \
  --value "CHANGE_ME" \
  --output none

az keyvault secret set --vault-name adla-staging-kv \
  --name analytics-ip-salt \
  --value "$(openssl rand -hex 32)" \
  --output none

# ── Key Vault (production) ─────────────────────────────────────
echo "==> Creating Key Vault: production"
az keyvault create \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-production-kv \
  --location "$LOCATION" \
  --output none

PG_PROD_HOST=$(az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-pg-production \
  --query fullyQualifiedDomainName -o tsv)

az keyvault secret set --vault-name adla-production-kv \
  --name db-connection-string \
  --value "postgresql://adla:${PG_PROD_PASS}@${PG_PROD_HOST}:5432/adla?schema=public&sslmode=require" \
  --output none

az keyvault secret set --vault-name adla-production-kv \
  --name jwt-secret \
  --value "$(openssl rand -base64 48)" \
  --output none

az keyvault secret set --vault-name adla-production-kv \
  --name jwt-refresh-secret \
  --value "$(openssl rand -base64 48)" \
  --output none

REDIS_PROD_KEY=$(az redis list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --query primaryKey -o tsv)
REDIS_PROD_HOST=$(az redis show \
  --resource-group "$RESOURCE_GROUP" \
  --name adla-redis-production \
  --query hostName -o tsv)

az keyvault secret set --vault-name adla-production-kv \
  --name redis-connection-string \
  --value "rediss://:${REDIS_PROD_KEY}@${REDIS_PROD_HOST}:6380" \
  --output none

STORAGE_PROD_KEY=$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name adlastorageprod \
  --query "[0].value" -o tsv)

az keyvault secret set --vault-name adla-production-kv \
  --name storage-access-key \
  --value "$STORAGE_PROD_KEY" \
  --output none

az keyvault secret set --vault-name adla-production-kv \
  --name storage-secret-key \
  --value "$STORAGE_PROD_KEY" \
  --output none

az keyvault secret set --vault-name adla-production-kv \
  --name smtp-password \
  --value "CHANGE_ME" \
  --output none

az keyvault secret set --vault-name adla-production-kv \
  --name analytics-ip-salt \
  --value "$(openssl rand -hex 32)" \
  --output none

# ── Grant AKS access to Key Vaults ────────────────────────────
echo "==> Granting AKS managed identity access to Key Vaults"
AKS_IDENTITY=$(az aks show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_CLUSTER" \
  --query identityProfile.kubeletidentity.objectId -o tsv)

az keyvault set-policy --name adla-staging-kv \
  --object-id "$AKS_IDENTITY" \
  --secret-permissions get list \
  --output none

az keyvault set-policy --name adla-production-kv \
  --object-id "$AKS_IDENTITY" \
  --secret-permissions get list \
  --output none

# ── Install NGINX Ingress + cert-manager ───────────────────────
echo "==> Installing NGINX Ingress Controller"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2

echo "==> Installing cert-manager"
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true

echo "==> Creating ClusterIssuers"
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: judedanbo@outlook.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: judedanbo@outlook.com
    privateKeySecretRef:
      name: letsencrypt-production-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# ── Create namespaces ──────────────────────────────────────────
echo "==> Creating namespaces"
kubectl create namespace adla-staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace adla-production --dry-run=client -o yaml | kubectl apply -f -

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "==> Provisioning complete!"
echo ""
echo "PostgreSQL staging password: $PG_STAGING_PASS"
echo "PostgreSQL production password: $PG_PROD_PASS"
echo ""
echo "Next steps:"
echo "  1. Update k8s/overlays/*/secret-provider-patch.yaml with tenantId and userAssignedIdentityID"
echo "  2. Update k8s/overlays/*/configmap-patch.yaml with MINIO_ENDPOINT and SMTP_HOST"
echo "  3. Set up GitHub OIDC federation (see Task 10)"
echo "  4. Update smtp-password secrets in both Key Vaults"
echo "  5. Create the develop branch: git checkout -b develop"
