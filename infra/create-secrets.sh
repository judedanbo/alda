#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:?Usage: $0 <namespace> (e.g. adla-staging or adla-production)}"

echo "==> Creating secrets in namespace: $NAMESPACE"
echo ""
echo "Enter values for each secret (leave blank to skip):"
echo ""

read -rp "DATABASE_URL: " DATABASE_URL
read -rp "JWT_SECRET: " JWT_SECRET
read -rp "JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET
read -rp "REDIS_URL: " REDIS_URL
read -rp "MINIO_ACCESS_KEY: " MINIO_ACCESS_KEY
read -rp "MINIO_SECRET_KEY: " MINIO_SECRET_KEY
read -rp "SMTP_PASS: " SMTP_PASS
read -rp "ANALYTICS_IP_SALT: " ANALYTICS_IP_SALT

kubectl create secret generic adla-secrets \
  --namespace "$NAMESPACE" \
  --from-literal="DATABASE_URL=${DATABASE_URL}" \
  --from-literal="JWT_SECRET=${JWT_SECRET}" \
  --from-literal="JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}" \
  --from-literal="REDIS_URL=${REDIS_URL}" \
  --from-literal="MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}" \
  --from-literal="MINIO_SECRET_KEY=${MINIO_SECRET_KEY}" \
  --from-literal="SMTP_PASS=${SMTP_PASS}" \
  --from-literal="ANALYTICS_IP_SALT=${ANALYTICS_IP_SALT}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "==> Secret 'adla-secrets' created/updated in namespace $NAMESPACE"
echo ""
echo "To update a single secret value later:"
echo "  kubectl edit secret adla-secrets -n $NAMESPACE"
