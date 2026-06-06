#!/usr/bin/env bash
set -euo pipefail

# Run a one-shot seed/bootstrap Job against an environment's in-cluster database.
# Assumes you already have cluster credentials (e.g. `az aks get-credentials ...`),
# same as the deploy pipeline.
#
# Usage: ./seed.sh <staging|production> <reference|test-data|bootstrap-admin>
#
# Env overrides applied automatically:
#   staging  + reference|test-data  -> NODE_ENV=staging (guards pass; demo accounts created)
#   production + reference          -> ALLOW_SEED_IN_PRODUCTION=true (reference data only)
#   production + bootstrap-admin    -> (none; reads BOOTSTRAP_ADMIN_* from adla-secrets)
#   production + test-data          -> REFUSED
#
# Image tag defaults to "<overlay>-latest"; override with IMAGE_TAG=<sha> ./seed.sh ...
ACR_NAME="${ACR_NAME:-regisry}"

ENVIRONMENT="${1:?Usage: $0 <staging|production> <reference|test-data|bootstrap-admin>}"
KIND="${2:?Usage: $0 <staging|production> <reference|test-data|bootstrap-admin>}"

case "$ENVIRONMENT" in
  staging)    NAMESPACE="adla-staging" ;;
  production) NAMESPACE="adla-production" ;;
  *) echo "ERROR: environment must be 'staging' or 'production' (got '$ENVIRONMENT')." >&2; exit 2 ;;
esac

case "$KIND" in
  reference)       SCRIPT="prisma/seed.ts";           COMPONENT="seed" ;;
  test-data)       SCRIPT="prisma/seed-demo.ts";       COMPONENT="seed" ;;
  bootstrap-admin) SCRIPT="prisma/bootstrap-admin.ts"; COMPONENT="bootstrap" ;;
  *) echo "ERROR: kind must be 'reference', 'test-data', or 'bootstrap-admin' (got '$KIND')." >&2; exit 2 ;;
esac

# Hard refusal: never load fictional demo data into production.
if [ "$ENVIRONMENT" = "production" ] && [ "$KIND" = "test-data" ]; then
  echo "ERROR: refusing to load test data into production." >&2
  exit 3
fi

# Per-(env, kind) env overrides injected as explicit container env (overrides the
# configmap's NODE_ENV=production).
EXTRA_ENV=""
if [ "$ENVIRONMENT" = "staging" ] && { [ "$KIND" = "reference" ] || [ "$KIND" = "test-data" ]; }; then
  EXTRA_ENV='
                  - name: NODE_ENV
                    value: "staging"'
elif [ "$ENVIRONMENT" = "production" ] && [ "$KIND" = "reference" ]; then
  EXTRA_ENV='
                  - name: ALLOW_SEED_IN_PRODUCTION
                    value: "true"'
fi

IMAGE_TAG="${IMAGE_TAG:-${ENVIRONMENT}-latest}"
IMAGE="${ACR_NAME}.azurecr.io/adla-migrate:${IMAGE_TAG}"
JOB_NAME="adla-${COMPONENT}-${KIND}-$(date +%s)"

echo "==> Running $SCRIPT as Job/$JOB_NAME in $NAMESPACE (image: $IMAGE)"

kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $JOB_NAME
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $JOB_NAME
    app.kubernetes.io/component: $COMPONENT
    app.kubernetes.io/part-of: adla
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/component: $COMPONENT
        app.kubernetes.io/part-of: adla
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: $IMAGE
          command: ["npx", "tsx", "$SCRIPT"]
          envFrom:
            - configMapRef:
                name: adla-config
            - secretRef:
                name: adla-secrets
          env:$EXTRA_ENV
          resources:
            requests:
              cpu: 128m
              memory: 256Mi
            limits:
              cpu: 512m
              memory: 1Gi
EOF

echo "==> Waiting for $JOB_NAME to complete (timeout 10m)..."
if kubectl wait --for=condition=complete --timeout=600s "job/$JOB_NAME" -n "$NAMESPACE"; then
  echo "==> $JOB_NAME completed. Logs:"
  kubectl logs "job/$JOB_NAME" -n "$NAMESPACE"
else
  echo "ERROR: $JOB_NAME did not complete. Logs:" >&2
  kubectl logs "job/$JOB_NAME" -n "$NAMESPACE" >&2 || true
  exit 1
fi
