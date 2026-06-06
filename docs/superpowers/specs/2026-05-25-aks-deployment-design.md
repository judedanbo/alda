# ADLA Application — Azure Kubernetes Service Deployment Design

## Overview

Deploy the ADLA (Asset Declaration Portal) Nuxt 4 application to Azure Kubernetes Service (AKS) with staging and production environments in a single cluster, using Azure managed services for data infrastructure and GitHub Actions for CI/CD.

**Scope:** Containerization, AKS cluster setup, managed services, CI/CD pipeline, secrets management, networking, and Kustomize manifest structure.

**Out of scope:** Application code changes (except minor env var wiring), WAF/DDoS protection, disaster recovery to a secondary region, custom domain DNS migration steps.

---

## Architecture Summary

```
Internet
    │
    ▼
Azure Load Balancer
    │
    ▼
NGINX Ingress Controller (TLS termination via cert-manager + Let's Encrypt)
    │
    ├── adla.gov.gh         → adla-production/app-service
    └── staging.adla.gov.gh → adla-staging/app-service
                                    │
                            ┌───────┴───────┐
                            │               │
                        app pods        worker pods
                        (Nuxt web)      (BullMQ)
                            │               │
                    ┌───────┼───────────────┤
                    ▼       ▼               ▼
            Azure DB for   Azure Cache   Azure Blob
            PostgreSQL     for Redis     Storage
            (private EP)   (private EP)  (S3 compat)
```

Single AKS cluster, two namespaces (`adla-staging`, `adla-production`). Each namespace has its own managed service instances, secrets, and ingress rules.

---

## 1. Azure Infrastructure

### 1.1 AKS Cluster

| Setting | Value |
|---|---|
| Region | `southafricanorth` (Johannesburg) — closest to Ghana |
| Kubernetes version | Latest stable (1.30.x) |
| SKU tier | Standard (99.95% control plane SLA) |
| System node pool | Standard_D2s_v3 (2 vCPU, 8 GiB), min 2 / max 4 nodes, autoscaler enabled |
| Identity | System-assigned managed identity |
| Network plugin | Azure CNI Overlay |
| Add-ons | Azure Monitor (Container Insights), Secrets Store CSI Driver, Azure Key Vault Provider |

### 1.2 Azure Container Registry (ACR)

| Setting | Value |
|---|---|
| SKU | Basic ($5/mo, 10 GiB) |
| Integration | AKS managed identity has AcrPull role — no image pull secrets needed |

### 1.3 Azure Database for PostgreSQL — Flexible Server

| Setting | Staging | Production |
|---|---|---|
| SKU | Burstable B1ms (1 vCPU, 2 GiB) | General Purpose D2ds_v4 (2 vCPU, 8 GiB) |
| Version | 16 | 16 |
| Storage | 32 GiB, auto-grow | 128 GiB, auto-grow |
| Backup | 7-day retention, locally redundant | 35-day retention, geo-redundant |
| HA | Disabled | Zone-redundant (same-region standby) |
| Connectivity | Private endpoint in AKS VNet | Private endpoint in AKS VNet |
| Estimated cost | ~$13/mo | ~$125/mo + HA standby |

### 1.4 Azure Cache for Redis

| Setting | Staging | Production |
|---|---|---|
| SKU | Basic C0 (250 MB) | Standard C1 (1 GB, replicated) |
| Version | 7 | 7 |
| Connectivity | Private endpoint in AKS VNet | Private endpoint in AKS VNet |
| Estimated cost | ~$16/mo | ~$81/mo |

### 1.5 Azure Blob Storage (replaces MinIO)

| Setting | Staging | Production |
|---|---|---|
| Account type | General-purpose v2 | General-purpose v2 |
| Redundancy | LRS | ZRS |
| Namespace | Flat (required for S3 compatibility) | Flat |
| Container | `adla-uploads` (private) | `adla-uploads` (private) |

The existing `storage.service.ts` uses the MinIO JS SDK which speaks S3 API. Azure Blob Storage's S3-compatible endpoint means zero code changes — only `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` env vars change.

### 1.6 Azure Key Vault

One Key Vault per environment, storing:
- `db-connection-string` — PostgreSQL connection URL
- `jwt-secret` — 64-char random string
- `jwt-refresh-secret` — 64-char random string
- `redis-connection-string` — Redis primary connection string
- `storage-access-key` — Blob Storage account key
- `storage-secret-key` — Blob Storage secondary key
- `smtp-password` — Production SMTP credential
- `analytics-ip-salt` — Random salt for IP hashing

AKS pods access secrets via the Secrets Store CSI Driver (no secrets in YAML or GitHub).

---

## 2. Kubernetes Architecture

### 2.1 Namespace Layout

Each environment namespace contains:

```
adla-{staging|production}/
├── deployment/adla-app          Nuxt web server (2-5 replicas)
├── deployment/adla-worker       BullMQ notification worker (1-2 replicas)
├── service/adla-app             ClusterIP → app pods port 3000
├── hpa/adla-app                 HorizontalPodAutoscaler (CPU 70%)
├── ingress/adla-ingress         NGINX routing + TLS
├── configmap/adla-config        Non-secret environment variables
├── secretproviderclass/adla-kv  CSI driver → Key Vault mapping
├── networkpolicy/adla-netpol    Ingress/egress rules
├── resourcequota/adla-quota     Namespace resource caps
├── limitrange/adla-limits       Default pod resource constraints
└── job/adla-migrate             Prisma migration (runs per deploy)
```

### 2.2 App Deployment

| Setting | Staging | Production |
|---|---|---|
| Image | `adlaacr.azurecr.io/adla-app:<git-sha>` | Same |
| Replicas | 2 (fixed) | 2-5 (HPA, 70% CPU) |
| CPU request / limit | 256m / 500m | 256m / 500m |
| Memory request / limit | 512Mi / 1Gi | 512Mi / 1Gi |
| Liveness probe | `GET /api/health` every 30s | Same |
| Readiness probe | `GET /api/health` every 10s | Same |
| Startup probe | `GET /api/health`, failureThreshold 30, period 10s | Same |

Environment variables:
- Non-secrets from ConfigMap (APP_URL, NODE_ENV, SMTP_HOST, SMTP_PORT, SMTP_FROM, MINIO_ENDPOINT, MINIO_BUCKET, feature flags)
- Secrets from Key Vault via CSI volume mount, projected as env vars

The web deployment runs with `NOTIFICATIONS_WORKER_ENABLED=false`.

### 2.3 Worker Deployment

Same container image as the app. Differentiated by environment variables:
- `NOTIFICATIONS_WORKER_ENABLED=true`
- `NOTIFICATIONS_QUEUE_ENABLED=true`

| Setting | Staging | Production |
|---|---|---|
| Replicas | 1 | 1-2 |
| CPU request / limit | 128m / 256m | 128m / 256m |
| Memory request / limit | 256Mi / 512Mi | 256Mi / 512Mi |

No Service or Ingress — workers poll Redis queues, they don't receive HTTP traffic.

### 2.4 Migration Job

A Kubernetes Job runs `npx prisma migrate deploy` before each deployment:
- Triggered by the CI/CD pipeline after image push, before pod rollout
- `backoffLimit: 3` — retries up to 3 times on failure
- `ttlSecondsAfterFinished: 300` — cleaned up 5 minutes after completion
- Pipeline fails and halts if the migration job fails

### 2.5 Ingress

NGINX Ingress Controller (installed via Helm in `ingress-nginx` namespace, shared across environments).

| Setting | Staging | Production |
|---|---|---|
| Host | `staging.adla.gov.gh` | `adla.gov.gh` |
| TLS | cert-manager, LE staging CA | cert-manager, LE production CA |
| Annotations | client-max-body-size: 10m, proxy-read-timeout: 60s | Same |

### 2.6 Scheduled Tasks

Nitro's built-in scheduled tasks (analytics rollup every 10 min, prune daily at 03:30) run inside app pods. Since multiple replicas run the same tasks, the tasks must be idempotent — which they are (aggregate/prune operations with upserts and date-based deletes).

No Kubernetes CronJobs needed.

---

## 3. CI/CD Pipeline

### 3.1 GitHub Actions Workflow: `deploy.yml`

**Triggers:**
- Push to `main` → deploy to production (with approval gate)
- Push to `develop` → deploy to staging (automatic)
- PRs → CI only (existing `ci.yml`)

**Stages:**

```
Stage 1: CI ──────────────── lint, typecheck, test, build (reuse ci.yml via workflow_call)
    │
Stage 2: Build & Push ────── docker build, tag with git SHA, push to ACR
    │
Stage 3: Migrate DB ──────── kubectl apply migration Job, wait for completion
    │
Stage 4: Deploy ──────────── kustomize build overlays/<env> | kubectl apply, rollout status
    │
Stage 5: Smoke Test ──────── curl https://<domain>/api/health, verify 200
```

### 3.2 Authentication

Azure OIDC federation — GitHub Actions authenticates to Azure using short-lived tokens from a federated identity credential. No long-lived service principal secrets.

**GitHub repository secrets (non-sensitive IDs, not passwords):**
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

**Azure AD app registration** with federated credentials scoped to:
- `AcrPush` on the ACR
- `Azure Kubernetes Service Cluster Admin` on the AKS cluster
- `Key Vault Secrets User` on both Key Vaults

### 3.3 GitHub Environments

| Environment | Protection rules |
|---|---|
| `staging` | None — auto-deploys on push to `develop` |
| `production` | Required reviewer (1), wait timer (5 minutes) |

### 3.4 Branch Strategy

- `main` — production deployments, protected branch
- `develop` — staging deployments, integration branch
- Feature branches → PRs to `develop` → CI runs, no deploy

---

## 4. Secrets Management

### 4.1 Flow

```
Azure Key Vault
    │ (Secrets Store CSI Driver)
    ▼
SecretProviderClass (per namespace)
    │ (mounts as volume, syncs to K8s Secret)
    ▼
Pod env vars (via envFrom or env.valueFrom)
```

### 4.2 Secret Rotation

- Rotate JWT secrets: update Key Vault, restart pods (rolling update)
- Rotate DB password: update in Azure Portal + Key Vault, restart pods
- Rotate storage keys: Azure generates new key, update Key Vault, restart pods
- CSI driver polls Key Vault every 2 minutes for changes

### 4.3 What Is NOT a Secret (ConfigMap)

All feature flags, SMTP host/port/from, storage endpoint/bucket name, analytics thresholds, rate limit numbers, app URL, node environment.

---

## 5. Networking

### 5.1 VNet Architecture

```
AKS VNet (10.0.0.0/16)
├── aks-subnet     (10.0.0.0/22)  — AKS nodes (1022 addresses)
├── pg-subnet      (10.0.4.0/24)  — PostgreSQL private endpoints
├── redis-subnet   (10.0.5.0/24)  — Redis private endpoints
└── storage-subnet (10.0.6.0/24)  — Blob Storage private endpoints
```

### 5.2 Network Policies

**Ingress rules:**
- App pods: allow from NGINX Ingress Controller only
- Worker pods: deny all ingress

**Egress rules:**
- App + Worker pods: allow to PostgreSQL (5432), Redis (6379), Blob Storage (443), DNS (53), SMTP (587/465)
- Deny all other egress

### 5.3 TLS

- cert-manager installed cluster-wide with two ClusterIssuers:
  - `letsencrypt-staging` — for the staging environment (avoids LE rate limits during testing)
  - `letsencrypt-production` — for the production environment
- HTTP-01 challenge solver via NGINX Ingress
- TLS terminates at the Ingress controller; pods receive plain HTTP on port 3000

---

## 6. Kustomize Directory Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── deployment-app.yaml
│   ├── deployment-worker.yaml
│   ├── service-app.yaml
│   ├── hpa-app.yaml
│   ├── configmap.yaml
│   ├── secret-provider-class.yaml
│   ├── ingress.yaml
│   ├── network-policy.yaml
│   ├── resource-quota.yaml
│   ├── limit-range.yaml
│   └── migration-job.yaml
├── overlays/
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   ├── configmap-patch.yaml
│   │   ├── ingress-patch.yaml
│   │   └── secret-provider-patch.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── configmap-patch.yaml
│       ├── ingress-patch.yaml
│       └── secret-provider-patch.yaml
```

**Base** defines all resources with staging-safe defaults. **Overlays** patch:
- Namespace name
- Image tag (via `kustomization.yaml` images transformer)
- Replica counts
- Resource requests/limits
- ConfigMap values (APP_URL, NODE_ENV, domain, feature flags)
- Ingress host and TLS secret name
- SecretProviderClass Key Vault name and tenant ID

---

## 7. Monitoring & Observability

- **Azure Monitor Container Insights** — enabled on AKS cluster, captures pod metrics, node metrics, and container logs (stdout/stderr)
- **Log Analytics Workspace** — centralized log store, queryable via KQL
- **Alerts:**
  - Pod restart count > 3 in 5 minutes
  - HPA at max replicas for > 10 minutes
  - Node pool at > 80% capacity
  - Migration Job failure
  - HTTP 5xx rate > 1% (from Ingress metrics)
- **Dashboards:** Azure Portal workbooks for cluster health, app performance, deployment history

---

## 8. Storage Adapter — MinIO SDK on Azure Blob

The existing `app/server/services/storage.service.ts` uses the MinIO JS SDK (S3 API). Azure Blob Storage provides S3-compatible access when:

1. Storage account uses flat namespace (not hierarchical/Data Lake)
2. S3-compatible endpoint is enabled on the account
3. Access is via storage account keys (not Azure AD — S3 compat doesn't support it)

**Configuration mapping:**

| App env var | MinIO (dev) | Azure Blob (prod) |
|---|---|---|
| `MINIO_ENDPOINT` | `minio` | `<account>.blob.core.windows.net` |
| `MINIO_PORT` | `9000` | `443` |
| `MINIO_ACCESS_KEY` | `minioadmin` | Storage account access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Storage account access key |
| `MINIO_USE_SSL` | `false` | `true` |
| `MINIO_BUCKET` | `adla-uploads` | `adla-uploads` |

No application code changes required for read/write operations. One caveat: the app's `makeBucket()` call on startup (auto-creates bucket if missing) may not work via S3 compatibility — pre-create the `adla-uploads` container via Azure CLI or Terraform during infrastructure provisioning.

---

## 9. Cost Estimate (Monthly)

| Service | Staging | Production |
|---|---|---|
| AKS control plane (Standard) | shared | shared (~$73) |
| AKS nodes (D2s_v3 × 2-4) | ~$140 (2 nodes) | ~$280 (4 nodes) |
| PostgreSQL Flexible Server | ~$13 | ~$125 |
| Azure Cache for Redis | ~$16 | ~$81 |
| Azure Blob Storage | ~$1 | ~$5 |
| Azure Key Vault | ~$0 (< 10K ops) | ~$0 |
| ACR Basic | shared | shared (~$5) |
| Azure Monitor | ~$0 (free tier) | ~$10 |
| **Total** | **~$170** | **~$579** |

Combined estimate: **~$750/mo** for staging + production.

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Single vs dual cluster | Single cluster, namespace isolation | Cost-effective for medium scale; resource quotas provide adequate isolation |
| Managed vs self-hosted infra | All managed (Postgres, Redis, Blob) | Compliance workload — managed backups and HA are essential |
| Storage adapter | Keep MinIO SDK, S3-compat on Azure Blob | Zero code changes; can refactor to native SDK later |
| CI/CD | GitHub Actions + OIDC federation | Extends existing workflow; no long-lived Azure credentials |
| K8s manifests | Kustomize with overlays | Right complexity level for single app; avoids Helm templating overhead |
| Worker separation | Separate deployment | Independent scaling of web vs background jobs |
| Secrets | Azure Key Vault + CSI Driver | No secrets in YAML, Git, or GitHub; automatic sync to pods |
| TLS | cert-manager + Let's Encrypt | Free, automatic certificate lifecycle |
| Scheduled tasks | Nitro-native (in-process) | Tasks are idempotent; avoids duplicating logic in CronJobs |
