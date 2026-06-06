#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
GITHUB_ORG="${GITHUB_ORG:-judedanbo}"
GITHUB_REPO="${GITHUB_REPO:-alda}"
APP_NAME="${APP_NAME:-adla-github-deploy}"
RESOURCE_GROUP="${RESOURCE_GROUP:-infosys}"
ACR_NAME="${ACR_NAME:-regisry}"
AKS_CLUSTER="${AKS_CLUSTER:-infosys}"

echo "==> Creating Azure AD app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "App (client) ID: $APP_ID"

echo "==> Creating service principal"
az ad sp create --id "$APP_ID" --output none

SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

echo "==> Adding federated credentials for GitHub environments"
# Deploy jobs declare `environment:`, so the OIDC subject is environment-scoped.
# Staging deploys on push to main; production deploys on a published release —
# both authenticate via these environment credentials (no ref-based creds needed).

# Staging environment
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-env-staging\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:staging\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" --output none

# Production environment
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-env-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" --output none

echo "==> Assigning roles"

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
AKS_ID=$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER" --query id -o tsv)

az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "AcrPush" \
  --scope "$ACR_ID" \
  --output none

az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "Azure Kubernetes Service Cluster Admin Role" \
  --scope "$AKS_ID" \
  --output none

# Note: secrets are delivered as plain kubectl Secrets (infra/create-secrets.sh),
# so no Azure Key Vault access is required.

TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
echo "==> Done! Add these as GitHub repository secrets:"
echo ""
echo "  AZURE_CLIENT_ID:       $APP_ID"
echo "  AZURE_TENANT_ID:       $TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo ""
echo "Create GitHub environments 'staging' and 'production' at:"
echo "  https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/settings/environments"
echo ""
echo "For 'production', enable:"
echo "  - Required reviewers (1)"
echo "  - Wait timer: 5 minutes"
echo ""
echo "Deploy model: merge to main → staging; publish a GitHub Release → production."
