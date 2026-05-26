#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:?Usage: $0 <namespace> (e.g. adla-staging or adla-production)}"

echo "==> Creating secrets in namespace: $NAMESPACE"
echo ""
echo "Enter values for each secret (leave blank to skip):"
echo ""

read -rsp "DATABASE_URL: " DATABASE_URL; echo
read -rsp "JWT_SECRET: " JWT_SECRET; echo
read -rsp "JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET; echo
read -rsp "REDIS_URL: " REDIS_URL; echo
read -rsp "MINIO_ACCESS_KEY: " MINIO_ACCESS_KEY; echo
read -rsp "MINIO_SECRET_KEY: " MINIO_SECRET_KEY; echo
read -rsp "SMTP_USER: " SMTP_USER; echo
read -rsp "SMTP_PASS: " SMTP_PASS; echo
read -rsp "ANALYTICS_IP_SALT: " ANALYTICS_IP_SALT; echo

kubectl create secret generic adla-secrets \
  --namespace "$NAMESPACE" \
  --from-literal="DATABASE_URL=${DATABASE_URL}" \
  --from-literal="JWT_SECRET=${JWT_SECRET}" \
  --from-literal="JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}" \
  --from-literal="REDIS_URL=${REDIS_URL}" \
  --from-literal="MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}" \
  --from-literal="MINIO_SECRET_KEY=${MINIO_SECRET_KEY}" \
  --from-literal="SMTP_USER=${SMTP_USER}" \
  --from-literal="SMTP_PASS=${SMTP_PASS}" \
  --from-literal="ANALYTICS_IP_SALT=${ANALYTICS_IP_SALT}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "==> Secret 'adla-secrets' created/updated in namespace $NAMESPACE"
echo ""
echo "To update a single secret value later:"
echo "  kubectl edit secret adla-secrets -n $NAMESPACE"
