# AKS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the ADLA Nuxt 4 app to a single AKS cluster with staging and production namespaces, Azure managed services, GitHub Actions CI/CD, and Kustomize manifests.

**Architecture:** Single AKS cluster in `southafricanorth`, two namespaces (`adla-staging`, `adla-production`). Azure managed Postgres, Redis, Blob Storage connected via private endpoints. NGINX Ingress with cert-manager TLS. Secrets from Azure Key Vault via CSI driver. GitHub Actions deploys on push to `develop` (staging) or `main` (production, gated).

**Tech Stack:** AKS, Kustomize, GitHub Actions, Azure CLI, cert-manager, NGINX Ingress Controller, Azure Key Vault CSI Driver

**Spec:** `docs/superpowers/specs/2026-05-25-aks-deployment-design.md`

---

## File Map

### New files

```
k8s/
├── base/
│   ├── kustomization.yaml              — lists all base resources
│   ├── namespace.yaml                  — namespace template (patched per overlay)
│   ├── deployment-app.yaml             — Nuxt web server deployment
│   ├── deployment-worker.yaml          — BullMQ worker deployment
│   ├── service-app.yaml                — ClusterIP service for app pods
│   ├── hpa-app.yaml                    — HorizontalPodAutoscaler for app
│   ├── configmap.yaml                  — non-secret env vars (staging defaults)
│   ├── secret-provider-class.yaml      — CSI driver SecretProviderClass for Key Vault
│   ├── ingress.yaml                    — NGINX Ingress rule
│   ├── network-policy.yaml             — ingress/egress firewall rules
│   ├── resource-quota.yaml             — namespace resource caps
│   ├── limit-range.yaml                — default pod resource constraints
│   └── migration-job.yaml              — Prisma migrate deploy Job
├── overlays/
│   ├── staging/
│   │   ├── kustomization.yaml          — staging patches + image tag
│   │   ├── namespace-patch.yaml        — sets namespace to adla-staging
│   │   ├── configmap-patch.yaml        — staging env var overrides
│   │   ├── ingress-patch.yaml          — staging.adla.gov.gh host + TLS
│   │   ├── secret-provider-patch.yaml  — staging Key Vault name
│   │   └── hpa-patch.yaml             — disable HPA (fixed replicas)
│   └── production/
│       ├── kustomization.yaml          — production patches + image tag
│       ├── namespace-patch.yaml        — sets namespace to adla-production
│       ├── configmap-patch.yaml        — production env var overrides
│       ├── ingress-patch.yaml          — adla.gov.gh host + TLS
│       ├── secret-provider-patch.yaml  — production Key Vault name
│       └── replica-patch.yaml          — production replica counts
infra/
├── provision.sh                        — Azure CLI script to create all resources
└── teardown.sh                         — Azure CLI script to delete all resources

.github/workflows/
├── ci.yml                              — modified: add workflow_call trigger
└── deploy.yml                          — new: build, push, migrate, deploy, smoke test
```

### Modified files

```
app/docker/Dockerfile                   — add migration stage (prisma CLI + migrate deploy)
app/.dockerignore                       — add prisma/migrations to ensure they're included
```

---

## Task 1: Update Dockerfile with Migration Stage

The production Dockerfile currently copies the Prisma schema and generated client but does NOT include the `prisma` CLI or migration files. The Kubernetes migration Job needs an image that can run `npx prisma migrate deploy`.

**Files:**
- Modify: `app/docker/Dockerfile`

- [ ] **Step 1: Add a migration target stage to the Dockerfile**

Add a third stage between builder and production that retains the Prisma CLI for running migrations. The production stage stays lean (no CLI).

In `app/docker/Dockerfile`, replace the entire file with:

```dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install libc6-compat for Prisma
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npm run db:generate

# Copy rest of the application
COPY . .

# Build the application
RUN npm run build

# Migration stage — used by the K8s migration Job
FROM node:22-alpine AS migration

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

CMD ["npx", "prisma", "migrate", "deploy"]

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxt

# Copy built application
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxt:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nuxt:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Set user
USER nuxt

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Verify the Dockerfile builds both targets locally**

Run from the repo root:

```bash
docker build -f app/docker/Dockerfile --target production -t adla-app:test app/
docker build -f app/docker/Dockerfile --target migration -t adla-migrate:test app/
```

Expected: both build successfully. The migration image is ~300 MB (has node_modules), the production image is ~200 MB (only .output).

- [ ] **Step 3: Commit**

```bash
git add app/docker/Dockerfile
git commit -m "feat(docker): add migration stage for K8s prisma migrate job"
```

---

## Task 2: Kustomize Base — Namespace, ConfigMap, LimitRange, ResourceQuota

Foundation resources that every environment needs. These are environment-agnostic templates with staging-safe defaults.

**Files:**
- Create: `k8s/base/kustomization.yaml`
- Create: `k8s/base/namespace.yaml`
- Create: `k8s/base/configmap.yaml`
- Create: `k8s/base/limit-range.yaml`
- Create: `k8s/base/resource-quota.yaml`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p k8s/base k8s/overlays/staging k8s/overlays/production
```

- [ ] **Step 2: Create `k8s/base/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: adla-staging
  labels:
    app.kubernetes.io/part-of: adla
```

- [ ] **Step 3: Create `k8s/base/configmap.yaml`**

All non-secret environment variables. Staging-safe defaults — overlays patch for production.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adla-config
  labels:
    app.kubernetes.io/part-of: adla
data:
  NODE_ENV: "production"
  APP_URL: "https://staging.adla.gov.gh"
  HOST: "0.0.0.0"
  PORT: "3000"

  # SMTP (host/port/from are not secrets)
  SMTP_HOST: ""
  SMTP_PORT: "587"
  SMTP_FROM: "noreply@adla.gov.gh"
  SMTP_USER: ""

  # Storage (endpoint/bucket are not secrets)
  MINIO_ENDPOINT: ""
  MINIO_PORT: "443"
  MINIO_BUCKET: "adla-uploads"
  MINIO_USE_SSL: "true"

  # Notification queue
  NOTIFICATIONS_QUEUE_ENABLED: "true"
  NOTIFICATIONS_WORKER_ENABLED: "false"
  NOTIFICATIONS_EMAIL_CONCURRENCY: "5"
  NOTIFICATIONS_SMS_CONCURRENCY: "5"
  NOTIFICATIONS_MAX_ATTEMPTS: "3"
  NOTIFICATIONS_READ_RETENTION_DAYS: "90"
  NOTIFICATIONS_UNREAD_RETENTION_DAYS: "180"
  NOTIFICATIONS_RATE_LIMIT_PER_HOUR: "10"

  # Analytics
  ANALYTICS_ENABLED: "true"
  ANALYTICS_CAPTURE_ENABLED: "true"
  ANALYTICS_ABUSE_ENABLED: "true"
  ANALYTICS_AI_DETECTION_ENABLED: "true"
  ANALYTICS_RATE_LIMIT_ENABLED: "true"
  ANALYTICS_RESPECT_DNT: "true"
  ANALYTICS_RETENTION_DAYS: "30"
  ANALYTICS_ROLLUP_RETENTION_DAYS: "365"
  ANALYTICS_EXCLUDE_PATHS: "/_nuxt,/__nuxt,/_ipx,/favicon.ico,/api/health,/api/admin/analytics"
  ANALYTICS_STORAGE_DRIVER: "redis"
  ANALYTICS_SESSION_WINDOW_MINUTES: "30"

  # Rate limits
  ANALYTICS_RL_IP_PER_MIN: "300"
  ANALYTICS_RL_AUTH_PER_MIN: "15"
  ANALYTICS_RL_WRITE_PER_MIN: "90"
  ANALYTICS_RL_UPLOAD_PER_5MIN: "30"
  ANALYTICS_RL_USER_PER_MIN: "600"
  ANALYTICS_RL_ABUSIVE_MULTIPLIER: "0.2"
  ANALYTICS_RL_AI_THROTTLE_MULTIPLIER: "0.25"

  # Abuse detection
  ANALYTICS_ABUSE_FLOOD_PER_MIN: "600"
  ANALYTICS_ABUSE_ERROR_RATE: "0.6"
  ANALYTICS_ABUSE_DISTINCT_404: "12"
  ANALYTICS_ABUSE_FAILED_LOGINS: "8"
  ANALYTICS_ABUSE_SUSPICIOUS_SCORE: "40"
  ANALYTICS_ABUSE_ABUSIVE_SCORE: "75"
  ANALYTICS_ABUSE_BLOCK_MINUTES: "30"

  # AI crawler policy
  ANALYTICS_AI_TRAINING_POLICY: "block"
  ANALYTICS_AI_SEARCH_POLICY: "allow"
  ANALYTICS_AI_LIVE_RETRIEVAL_POLICY: "log"
  ANALYTICS_AI_UNKNOWN_POLICY: "throttle"
  ANALYTICS_AI_ROBOTS_ENFORCEMENT: "true"
  ANALYTICS_AI_IP_RANGE_REFRESH_HOURS: "24"

  # SMS provider
  SMS_PROVIDER: "hubtel"
  HUBTEL_SENDER_ID: "ADLA"
  ARKESEL_SENDER_ID: "ADLA"
```

- [ ] **Step 4: Create `k8s/base/limit-range.yaml`**

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: adla-limits
  labels:
    app.kubernetes.io/part-of: adla
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 1Gi
      defaultRequest:
        cpu: 128m
        memory: 256Mi
      max:
        cpu: "2"
        memory: 2Gi
```

- [ ] **Step 5: Create `k8s/base/resource-quota.yaml`**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: adla-quota
  labels:
    app.kubernetes.io/part-of: adla
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "5"
```

- [ ] **Step 6: Create `k8s/base/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

commonLabels:
  app.kubernetes.io/part-of: adla
  app.kubernetes.io/managed-by: kustomize

resources:
  - namespace.yaml
  - configmap.yaml
  - limit-range.yaml
  - resource-quota.yaml
  - secret-provider-class.yaml
  - deployment-app.yaml
  - deployment-worker.yaml
  - service-app.yaml
  - hpa-app.yaml
  - ingress.yaml
  - network-policy.yaml
  - migration-job.yaml
```

- [ ] **Step 7: Commit**

```bash
git add k8s/base/kustomization.yaml k8s/base/namespace.yaml k8s/base/configmap.yaml k8s/base/limit-range.yaml k8s/base/resource-quota.yaml
git commit -m "feat(k8s): add base namespace, configmap, limits, and quota"
```

---

## Task 3: Kustomize Base — SecretProviderClass

Wires Azure Key Vault secrets into pods via the Secrets Store CSI Driver.

**Files:**
- Create: `k8s/base/secret-provider-class.yaml`

- [ ] **Step 1: Create `k8s/base/secret-provider-class.yaml`**

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: adla-kv
  labels:
    app.kubernetes.io/part-of: adla
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: ""
    keyvaultName: "adla-staging-kv"
    tenantId: ""
    objects: |
      array:
        - |
          objectName: db-connection-string
          objectType: secret
          objectAlias: DATABASE_URL
        - |
          objectName: jwt-secret
          objectType: secret
          objectAlias: JWT_SECRET
        - |
          objectName: jwt-refresh-secret
          objectType: secret
          objectAlias: JWT_REFRESH_SECRET
        - |
          objectName: redis-connection-string
          objectType: secret
          objectAlias: REDIS_URL
        - |
          objectName: storage-access-key
          objectType: secret
          objectAlias: MINIO_ACCESS_KEY
        - |
          objectName: storage-secret-key
          objectType: secret
          objectAlias: MINIO_SECRET_KEY
        - |
          objectName: smtp-password
          objectType: secret
          objectAlias: SMTP_PASS
        - |
          objectName: analytics-ip-salt
          objectType: secret
          objectAlias: ANALYTICS_IP_SALT
  secretObjects:
    - secretName: adla-secrets
      type: Opaque
      data:
        - objectName: DATABASE_URL
          key: DATABASE_URL
        - objectName: JWT_SECRET
          key: JWT_SECRET
        - objectName: JWT_REFRESH_SECRET
          key: JWT_REFRESH_SECRET
        - objectName: REDIS_URL
          key: REDIS_URL
        - objectName: MINIO_ACCESS_KEY
          key: MINIO_ACCESS_KEY
        - objectName: MINIO_SECRET_KEY
          key: MINIO_SECRET_KEY
        - objectName: SMTP_PASS
          key: SMTP_PASS
        - objectName: ANALYTICS_IP_SALT
          key: ANALYTICS_IP_SALT
```

- [ ] **Step 2: Commit**

```bash
git add k8s/base/secret-provider-class.yaml
git commit -m "feat(k8s): add SecretProviderClass for Key Vault integration"
```

---

## Task 4: Kustomize Base — App Deployment and Service

The core Nuxt web server deployment and its ClusterIP service.

**Files:**
- Create: `k8s/base/deployment-app.yaml`
- Create: `k8s/base/service-app.yaml`

- [ ] **Step 1: Create `k8s/base/deployment-app.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adla-app
  labels:
    app.kubernetes.io/name: adla-app
    app.kubernetes.io/component: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: adla-app
      app.kubernetes.io/component: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-app
        app.kubernetes.io/component: web
    spec:
      serviceAccountName: default
      containers:
        - name: app
          image: adlaacr.azurecr.io/adla-app:latest
          ports:
            - containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: adla-config
            - secretRef:
                name: adla-secrets
          resources:
            requests:
              cpu: 256m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
          startupProbe:
            httpGet:
              path: /api/health
              port: 3000
            failureThreshold: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 30
            failureThreshold: 3
          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true
      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true
            volumeAttributes:
              secretProviderClass: adla-kv
```

- [ ] **Step 2: Create `k8s/base/service-app.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: adla-app
  labels:
    app.kubernetes.io/name: adla-app
    app.kubernetes.io/component: web
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: adla-app
    app.kubernetes.io/component: web
```

- [ ] **Step 3: Commit**

```bash
git add k8s/base/deployment-app.yaml k8s/base/service-app.yaml
git commit -m "feat(k8s): add app deployment and ClusterIP service"
```

---

## Task 5: Kustomize Base — Worker Deployment

The BullMQ notification worker — same image, different env vars, no service.

**Files:**
- Create: `k8s/base/deployment-worker.yaml`

- [ ] **Step 1: Create `k8s/base/deployment-worker.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adla-worker
  labels:
    app.kubernetes.io/name: adla-worker
    app.kubernetes.io/component: worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: adla-worker
      app.kubernetes.io/component: worker
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-worker
        app.kubernetes.io/component: worker
    spec:
      serviceAccountName: default
      containers:
        - name: worker
          image: adlaacr.azurecr.io/adla-app:latest
          envFrom:
            - configMapRef:
                name: adla-config
            - secretRef:
                name: adla-secrets
          env:
            - name: NOTIFICATIONS_WORKER_ENABLED
              value: "true"
            - name: NOTIFICATIONS_QUEUE_ENABLED
              value: "true"
          resources:
            requests:
              cpu: 128m
              memory: 256Mi
            limits:
              cpu: 256m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 30
            failureThreshold: 3
          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true
      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true
            volumeAttributes:
              secretProviderClass: adla-kv
```

- [ ] **Step 2: Commit**

```bash
git add k8s/base/deployment-worker.yaml
git commit -m "feat(k8s): add BullMQ worker deployment"
```

---

## Task 6: Kustomize Base — HPA, Ingress, NetworkPolicy, Migration Job

Remaining base resources: autoscaling, routing, security, and database migrations.

**Files:**
- Create: `k8s/base/hpa-app.yaml`
- Create: `k8s/base/ingress.yaml`
- Create: `k8s/base/network-policy.yaml`
- Create: `k8s/base/migration-job.yaml`

- [ ] **Step 1: Create `k8s/base/hpa-app.yaml`**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: adla-app
  labels:
    app.kubernetes.io/name: adla-app
    app.kubernetes.io/component: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: adla-app
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

- [ ] **Step 2: Create `k8s/base/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: adla-ingress
  labels:
    app.kubernetes.io/part-of: adla
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    cert-manager.io/cluster-issuer: letsencrypt-staging
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - staging.adla.gov.gh
      secretName: adla-tls
  rules:
    - host: staging.adla.gov.gh
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: adla-app
                port:
                  number: 3000
```

- [ ] **Step 3: Create `k8s/base/network-policy.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: adla-netpol
  labels:
    app.kubernetes.io/part-of: adla
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/part-of: adla
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from NGINX Ingress Controller to app pods only
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
          podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - port: 3000
          protocol: TCP
  egress:
    # DNS
    - to: []
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # PostgreSQL
    - to: []
      ports:
        - port: 5432
          protocol: TCP
    # Redis
    - to: []
      ports:
        - port: 6379
          protocol: TCP
        - port: 6380
          protocol: TCP
    # Azure Blob Storage / HTTPS
    - to: []
      ports:
        - port: 443
          protocol: TCP
    # SMTP
    - to: []
      ports:
        - port: 587
          protocol: TCP
        - port: 465
          protocol: TCP
```

- [ ] **Step 4: Create `k8s/base/migration-job.yaml`**

This Job uses the `migration` target from the Dockerfile. It runs `prisma migrate deploy` before the app deployment rolls out.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: adla-migrate
  labels:
    app.kubernetes.io/name: adla-migrate
    app.kubernetes.io/component: migration
spec:
  backoffLimit: 3
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-migrate
        app.kubernetes.io/component: migration
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: adlaacr.azurecr.io/adla-migrate:latest
          envFrom:
            - secretRef:
                name: adla-secrets
          resources:
            requests:
              cpu: 128m
              memory: 256Mi
            limits:
              cpu: 256m
              memory: 512Mi
          volumeMounts:
            - name: secrets-store
              mountPath: /mnt/secrets-store
              readOnly: true
      volumes:
        - name: secrets-store
          csi:
            driver: secrets-store.csi.k8s.io
            readOnly: true
            volumeAttributes:
              secretProviderClass: adla-kv
```

- [ ] **Step 5: Validate the base builds**

```bash
cd k8s && kustomize build base/
```

Expected: all YAML renders without errors. Manifests will use `adla-staging` namespace and staging defaults.

If `kustomize` is not installed, use:

```bash
kubectl kustomize k8s/base/
```

- [ ] **Step 6: Commit**

```bash
git add k8s/base/hpa-app.yaml k8s/base/ingress.yaml k8s/base/network-policy.yaml k8s/base/migration-job.yaml
git commit -m "feat(k8s): add HPA, ingress, network policy, and migration job"
```

---

## Task 7: Kustomize Staging Overlay

Staging overlay patches the base with staging-specific values. Most base defaults are already staging-safe, so patches are minimal.

**Files:**
- Create: `k8s/overlays/staging/kustomization.yaml`
- Create: `k8s/overlays/staging/namespace-patch.yaml`
- Create: `k8s/overlays/staging/configmap-patch.yaml`
- Create: `k8s/overlays/staging/ingress-patch.yaml`
- Create: `k8s/overlays/staging/secret-provider-patch.yaml`
- Create: `k8s/overlays/staging/hpa-patch.yaml`

- [ ] **Step 1: Create `k8s/overlays/staging/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: adla-staging

resources:
  - ../../base

patches:
  - path: namespace-patch.yaml
  - path: configmap-patch.yaml
  - path: ingress-patch.yaml
  - path: secret-provider-patch.yaml
  - path: hpa-patch.yaml

images:
  - name: adlaacr.azurecr.io/adla-app
    newTag: staging-latest
  - name: adlaacr.azurecr.io/adla-migrate
    newTag: staging-latest
```

- [ ] **Step 2: Create `k8s/overlays/staging/namespace-patch.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: adla-staging
```

- [ ] **Step 3: Create `k8s/overlays/staging/configmap-patch.yaml`**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adla-config
data:
  APP_URL: "https://staging.adla.gov.gh"
  MINIO_ENDPOINT: ""
```

The `MINIO_ENDPOINT` and `SMTP_HOST` are left empty here — they must be filled in after Azure infrastructure provisioning with the actual resource endpoints. The CI/CD pipeline sets the image tag; these values are set once during initial setup.

- [ ] **Step 4: Create `k8s/overlays/staging/ingress-patch.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: adla-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
spec:
  tls:
    - hosts:
        - staging.adla.gov.gh
      secretName: adla-staging-tls
  rules:
    - host: staging.adla.gov.gh
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: adla-app
                port:
                  number: 3000
```

- [ ] **Step 5: Create `k8s/overlays/staging/secret-provider-patch.yaml`**

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: adla-kv
spec:
  parameters:
    keyvaultName: "adla-staging-kv"
    tenantId: ""
    userAssignedIdentityID: ""
```

`tenantId` and `userAssignedIdentityID` must be filled after Azure AD setup.

- [ ] **Step 6: Create `k8s/overlays/staging/hpa-patch.yaml`**

Staging uses fixed 2 replicas — disable HPA by setting min=max=2.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: adla-app
spec:
  minReplicas: 2
  maxReplicas: 2
```

- [ ] **Step 7: Validate staging overlay builds**

```bash
kustomize build k8s/overlays/staging/
```

Expected: all resources render with `adla-staging` namespace, staging host, and staging Key Vault.

- [ ] **Step 8: Commit**

```bash
git add k8s/overlays/staging/
git commit -m "feat(k8s): add staging overlay"
```

---

## Task 8: Kustomize Production Overlay

Production overlay patches for production domain, Key Vault, and higher replica counts.

**Files:**
- Create: `k8s/overlays/production/kustomization.yaml`
- Create: `k8s/overlays/production/namespace-patch.yaml`
- Create: `k8s/overlays/production/configmap-patch.yaml`
- Create: `k8s/overlays/production/ingress-patch.yaml`
- Create: `k8s/overlays/production/secret-provider-patch.yaml`
- Create: `k8s/overlays/production/replica-patch.yaml`

- [ ] **Step 1: Create `k8s/overlays/production/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: adla-production

resources:
  - ../../base

patches:
  - path: namespace-patch.yaml
  - path: configmap-patch.yaml
  - path: ingress-patch.yaml
  - path: secret-provider-patch.yaml
  - path: replica-patch.yaml

images:
  - name: adlaacr.azurecr.io/adla-app
    newTag: production-latest
  - name: adlaacr.azurecr.io/adla-migrate
    newTag: production-latest
```

- [ ] **Step 2: Create `k8s/overlays/production/namespace-patch.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: adla-production
```

- [ ] **Step 3: Create `k8s/overlays/production/configmap-patch.yaml`**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adla-config
data:
  APP_URL: "https://adla.gov.gh"
  MINIO_ENDPOINT: ""
```

- [ ] **Step 4: Create `k8s/overlays/production/ingress-patch.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: adla-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-production
spec:
  tls:
    - hosts:
        - adla.gov.gh
      secretName: adla-production-tls
  rules:
    - host: adla.gov.gh
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: adla-app
                port:
                  number: 3000
```

- [ ] **Step 5: Create `k8s/overlays/production/secret-provider-patch.yaml`**

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: adla-kv
spec:
  parameters:
    keyvaultName: "adla-production-kv"
    tenantId: ""
    userAssignedIdentityID: ""
```

- [ ] **Step 6: Create `k8s/overlays/production/replica-patch.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adla-app
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adla-worker
spec:
  replicas: 2
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: adla-app
spec:
  minReplicas: 2
  maxReplicas: 5
```

- [ ] **Step 7: Validate production overlay builds**

```bash
kustomize build k8s/overlays/production/
```

Expected: all resources render with `adla-production` namespace, `adla.gov.gh` host, production Key Vault, and higher replicas.

- [ ] **Step 8: Commit**

```bash
git add k8s/overlays/production/
git commit -m "feat(k8s): add production overlay"
```

---

## Task 9: Azure Infrastructure Provisioning Script

A shell script that creates all Azure resources. Idempotent — safe to run multiple times.

**Files:**
- Create: `infra/provision.sh`
- Create: `infra/teardown.sh`

- [ ] **Step 1: Create `infra/provision.sh`**

```bash
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

# Preserve the real client source IP end-to-end. The default LoadBalancer
# Service policy (Cluster) makes the Azure LB SNAT the client IP to a node IP
# before it reaches nginx, so X-Forwarded-For carries a single 10.x node IP and
# Web Analytics / rate-limiting / audit logs all record that instead of the real
# client (regardless of ANALYTICS_TRUSTED_PROXIES). Set the Service to Local:
echo "==> Preserving client source IP on the ingress LoadBalancer"
kubectl patch svc ingress-nginx-controller -n ingress-nginx \
  --type merge -p '{"spec":{"externalTrafficPolicy":"Local"}}'
# Verify: kubectl get svc ingress-nginx-controller -n ingress-nginx \
#   -o jsonpath='{.spec.externalTrafficPolicy}'  → Local

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
```

- [ ] **Step 2: Create `infra/teardown.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-adla-rg}"

echo "WARNING: This will delete ALL resources in resource group '$RESOURCE_GROUP'."
echo "Press Ctrl+C within 10 seconds to abort."
sleep 10

echo "==> Deleting resource group: $RESOURCE_GROUP"
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo "==> Deletion initiated (runs in background). Monitor in Azure Portal."
```

- [ ] **Step 3: Make scripts executable**

```bash
chmod +x infra/provision.sh infra/teardown.sh
```

- [ ] **Step 4: Commit**

```bash
git add infra/
git commit -m "feat(infra): add Azure provisioning and teardown scripts"
```

---

## Task 10: Refactor CI Workflow for Reuse + Create Deploy Workflow

Modify the existing CI workflow to support `workflow_call` so the deploy workflow can reuse it. Then create the full deploy pipeline.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add `workflow_call` trigger to `ci.yml`**

Add `workflow_call` alongside the existing triggers so `deploy.yml` can invoke CI as a reusable workflow.

In `.github/workflows/ci.yml`, replace the `on:` block:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_call:
```

Everything else in `ci.yml` stays the same.

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main, develop]

permissions:
  id-token: write
  contents: read

env:
  ACR_NAME: adlaacr
  AKS_CLUSTER: adla-aks
  RESOURCE_GROUP: adla-rg

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  set-env:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      overlay: ${{ steps.env.outputs.overlay }}
      namespace: ${{ steps.env.outputs.namespace }}
      domain: ${{ steps.env.outputs.domain }}
    steps:
      - id: env
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "environment=production" >> "$GITHUB_OUTPUT"
            echo "overlay=production" >> "$GITHUB_OUTPUT"
            echo "namespace=adla-production" >> "$GITHUB_OUTPUT"
            echo "domain=adla.gov.gh" >> "$GITHUB_OUTPUT"
          else
            echo "environment=staging" >> "$GITHUB_OUTPUT"
            echo "overlay=staging" >> "$GITHUB_OUTPUT"
            echo "namespace=adla-staging" >> "$GITHUB_OUTPUT"
            echo "domain=staging.adla.gov.gh" >> "$GITHUB_OUTPUT"
          fi

  build-and-push:
    needs: [ci, set-env]
    runs-on: ubuntu-latest
    environment: ${{ needs.set-env.outputs.environment }}
    steps:
      - uses: actions/checkout@v6

      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Login to ACR
        run: az acr login --name ${{ env.ACR_NAME }}

      - name: Build and push app image
        run: |
          docker build \
            -f app/docker/Dockerfile \
            --target production \
            -t ${{ env.ACR_NAME }}.azurecr.io/adla-app:${{ github.sha }} \
            -t ${{ env.ACR_NAME }}.azurecr.io/adla-app:${{ needs.set-env.outputs.overlay }}-latest \
            app/
          docker push ${{ env.ACR_NAME }}.azurecr.io/adla-app --all-tags

      - name: Build and push migration image
        run: |
          docker build \
            -f app/docker/Dockerfile \
            --target migration \
            -t ${{ env.ACR_NAME }}.azurecr.io/adla-migrate:${{ github.sha }} \
            -t ${{ env.ACR_NAME }}.azurecr.io/adla-migrate:${{ needs.set-env.outputs.overlay }}-latest \
            app/
          docker push ${{ env.ACR_NAME }}.azurecr.io/adla-migrate --all-tags

  migrate:
    needs: [build-and-push, set-env]
    runs-on: ubuntu-latest
    environment: ${{ needs.set-env.outputs.environment }}
    steps:
      - uses: actions/checkout@v6

      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Get AKS credentials
        run: |
          az aks get-credentials \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --name ${{ env.AKS_CLUSTER }} \
            --overwrite-existing

      - name: Run migration Job
        run: |
          NAMESPACE="${{ needs.set-env.outputs.namespace }}"
          IMAGE="${{ env.ACR_NAME }}.azurecr.io/adla-migrate:${{ github.sha }}"
          JOB_NAME="adla-migrate-${{ github.run_number }}"

          # Delete previous migration job if it exists
          kubectl delete job "$JOB_NAME" -n "$NAMESPACE" --ignore-not-found

          # Create and run migration job from the base template with overrides
          kubectl create job "$JOB_NAME" \
            --namespace "$NAMESPACE" \
            --image "$IMAGE" \
            -- npx prisma migrate deploy

          # Wait for the job to complete (timeout 5 minutes)
          kubectl wait --for=condition=complete \
            --timeout=300s \
            "job/$JOB_NAME" \
            -n "$NAMESPACE"

  deploy:
    needs: [migrate, set-env]
    runs-on: ubuntu-latest
    environment: ${{ needs.set-env.outputs.environment }}
    steps:
      - uses: actions/checkout@v6

      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Get AKS credentials
        run: |
          az aks get-credentials \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --name ${{ env.AKS_CLUSTER }} \
            --overwrite-existing

      - name: Deploy with Kustomize
        run: |
          OVERLAY="${{ needs.set-env.outputs.overlay }}"

          # Set the image tag to the current commit SHA
          cd k8s/overlays/$OVERLAY
          kustomize edit set image \
            adlaacr.azurecr.io/adla-app=adlaacr.azurecr.io/adla-app:${{ github.sha }} \
            adlaacr.azurecr.io/adla-migrate=adlaacr.azurecr.io/adla-migrate:${{ github.sha }}
          cd -

          # Apply manifests
          kustomize build k8s/overlays/$OVERLAY | kubectl apply -f -

      - name: Wait for rollout
        run: |
          NAMESPACE="${{ needs.set-env.outputs.namespace }}"
          kubectl rollout status deployment/adla-app -n "$NAMESPACE" --timeout=300s
          kubectl rollout status deployment/adla-worker -n "$NAMESPACE" --timeout=300s

  smoke-test:
    needs: [deploy, set-env]
    runs-on: ubuntu-latest
    steps:
      - name: Health check
        run: |
          DOMAIN="${{ needs.set-env.outputs.domain }}"
          echo "Waiting 30s for ingress to stabilize..."
          sleep 30

          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health" --max-time 30 || true)

          if [ "$STATUS" = "200" ]; then
            echo "Health check passed (HTTP $STATUS)"
          else
            echo "WARNING: Health check returned HTTP $STATUS (may need DNS propagation)"
            echo "This is expected on first deploy before DNS is configured."
          fi
```

- [ ] **Step 3: Validate workflow YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "Valid YAML"
```

Expected: `Valid YAML`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "feat(ci): add deploy workflow with OIDC auth, migration, and smoke test"
```

---

## Task 11: GitHub OIDC Federation Setup Script

A script the user runs once to configure Azure AD federated credentials for GitHub Actions.

**Files:**
- Create: `infra/setup-github-oidc.sh`

- [ ] **Step 1: Create `infra/setup-github-oidc.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
GITHUB_ORG="${GITHUB_ORG:-judedanbo}"
GITHUB_REPO="${GITHUB_REPO:-alda}"
APP_NAME="${APP_NAME:-adla-github-deploy}"
RESOURCE_GROUP="${RESOURCE_GROUP:-adla-rg}"
ACR_NAME="${ACR_NAME:-adlaacr}"
AKS_CLUSTER="${AKS_CLUSTER:-adla-aks}"

echo "==> Creating Azure AD app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "App (client) ID: $APP_ID"

echo "==> Creating service principal"
az ad sp create --id "$APP_ID" --output none

SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

echo "==> Adding federated credentials for GitHub branches"

# Staging: develop branch
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-develop\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/develop\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" --output none

# Production: main branch
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" --output none

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

az keyvault set-policy --name adla-staging-kv \
  --object-id "$SP_OBJECT_ID" \
  --secret-permissions get list \
  --output none

az keyvault set-policy --name adla-production-kv \
  --object-id "$SP_OBJECT_ID" \
  --secret-permissions get list \
  --output none

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
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x infra/setup-github-oidc.sh
git add infra/setup-github-oidc.sh
git commit -m "feat(infra): add GitHub OIDC federation setup script"
```

---

## Task 12: Create develop Branch and Final Validation

Set up the branch strategy and do a final end-to-end validation of all manifests.

**Files:** None (git operations + validation only)

- [ ] **Step 1: Validate both overlays build cleanly**

```bash
kustomize build k8s/overlays/staging/ > /dev/null && echo "Staging: OK"
kustomize build k8s/overlays/production/ > /dev/null && echo "Production: OK"
```

Expected: both print OK with no errors.

- [ ] **Step 2: Dry-run against a cluster (if connected)**

If you have `kubectl` connected to a cluster:

```bash
kustomize build k8s/overlays/staging/ | kubectl apply --dry-run=client -f - 2>&1 | head -20
```

Expected: resources listed with `(dry run)` suffix, no errors.

If not connected to a cluster, skip this step.

- [ ] **Step 3: Create the develop branch**

```bash
git checkout -b develop
git push -u origin develop
```

Expected: `develop` branch created and pushed. This branch triggers staging deployments.

- [ ] **Step 4: Verify deploy.yml triggers on both branches**

Check the workflow trigger configuration:

```bash
grep -A3 "branches:" .github/workflows/deploy.yml | head -5
```

Expected output:
```
    branches: [main, develop]
```

---

## Post-Implementation Checklist

After all tasks are complete, these manual steps must be performed by the operator:

1. **Run `infra/provision.sh`** — creates all Azure resources (~30 min)
2. **Run `infra/setup-github-oidc.sh`** — configures GitHub ↔ Azure federation
3. **Add GitHub secrets** — `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
4. **Create GitHub environments** — `staging` (no protection) and `production` (1 reviewer + 5 min wait)
5. **Update Kustomize patches** with real values from provisioning output:
   - `tenantId` and `userAssignedIdentityID` in both `secret-provider-patch.yaml` files
   - `MINIO_ENDPOINT` and `SMTP_HOST` in both `configmap-patch.yaml` files
6. **Update Key Vault secrets** — replace `CHANGE_ME` smtp-password with real SMTP credentials
7. **Configure DNS** — point `adla.gov.gh` and `staging.adla.gov.gh` to the NGINX Ingress external IP
8. **Push to develop** — triggers first staging deployment
9. **Verify staging** — check `https://staging.adla.gov.gh/api/health`
10. **Merge to main** — triggers production deployment (after approval)
