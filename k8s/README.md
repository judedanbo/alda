# ADLA — Kubernetes Deployment

Deployment of the ADLA Nuxt 4 application to the existing Azure AKS cluster, with
separate **staging** and **production** namespaces. Postgres, Redis, and MinIO all
run **in-cluster** as StatefulSets; secrets are delivered as plain Kubernetes
Secrets; TLS is issued by cert-manager; ingress is served by ingress-nginx.

---

## Architecture at a glance

```
                          ingress-nginx (LoadBalancer, public IP)
                                   │  TLS via cert-manager (infosys-issuer)
                                   ▼
                          Ingress  adla-ingress
                                   │  :3000
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ namespace: adla-staging / adla-production                      │
   │                                                                │
   │   Deployment adla-app  ──┐     Deployment adla-worker          │
   │   (web, HPA)            │      (BullMQ email/SMS/audit)        │
   │                         ▼                                      │
   │            ConfigMap adla-config + Secret adla-secrets         │
   │                         │                                      │
   │      ┌──────────────────┼───────────────────┐                 │
   │      ▼                  ▼                   ▼                  │
   │  StatefulSet        StatefulSet         StatefulSet            │
   │  adla-postgres      adla-redis          adla-minio             │
   │  :5432  (32Gi)      :6379  (8Gi)        :9000  (50Gi)          │
   │                                                                │
   │  NetworkPolicy adla-netpol: ingress-nginx→app:3000,            │
   │  app↔data east-west on 5432/6379/9000, restricted egress       │
   └──────────────────────────────────────────────────────────────┘
```

| Resource | Value |
| --- | --- |
| AKS cluster / resource group | `infosys` / `infosys` |
| Container registry | `regisry.azurecr.io` |
| cert-manager ClusterIssuer | `infosys-issuer` |
| Ingress controller | ingress-nginx (`ingressClassName: nginx`) |
| Namespaces | `adla-staging`, `adla-production` |
| Trigger → environment | merge to `main` → staging; publish a GitHub Release → production |
| Production host | `alda.audit.gov.gh` |
| Staging host | `ttaging-alda.audit.gov.gh` *(temporary — DNS typo, to be corrected to `staging-alda.audit.gov.gh`)* |
| StorageClass | `managed-csi` (Azure Disk) |

---

## Repository layout

```
k8s/
├── base/                       # shared manifests (kustomize base)
│   ├── namespace.yaml          # bootstrap only (NOT in kustomization)
│   ├── configmap.yaml          # adla-config (non-secret env)
│   ├── limit-range.yaml        # bootstrap only (NOT in kustomization)
│   ├── resource-quota.yaml     # bootstrap only (NOT in kustomization)
│   ├── statefulset-postgres.yaml
│   ├── statefulset-redis.yaml
│   ├── statefulset-minio.yaml
│   ├── deployment-app.yaml     # web
│   ├── deployment-worker.yaml  # BullMQ workers
│   ├── service-app.yaml
│   ├── hpa-app.yaml
│   ├── ingress.yaml
│   ├── network-policy.yaml
│   ├── migration-job.yaml      # reference only (run per-deploy by the workflow)
│   ├── minio-init-job.yaml     # optional manual bucket creator
│   └── kustomization.yaml
└── overlays/
    ├── staging/                # namespace adla-staging, host ttaging-alda.*
    └── production/             # namespace adla-production, host alda.*
```

Secrets are **not** in this repo — they are created with
[`infra/create-secrets.sh`](../infra/create-secrets.sh). The migration Job and
MinIO-init Job are intentionally excluded from `kustomization.yaml` because Jobs
are immutable and the overlay is applied more than once per deploy.

---

## Prerequisites

On your workstation:

- `az` CLI (logged in: `az login`), with rights to create AD apps + role assignments
- `kubectl` (v1.27+) and `kustomize` (or `kubectl kustomize`)
- `openssl`, `git`, `gh` (GitHub CLI)

Already present on the cluster (do **not** recreate):

- AKS cluster `infosys`, ACR `regisry`
- ingress-nginx (in namespace `ingress-nginx`)
- cert-manager with a `ClusterIssuer` named `infosys-issuer`

Verify the cluster prerequisites:

```bash
az aks get-credentials --resource-group infosys --name infosys --overwrite-existing
kubectl get clusterissuer infosys-issuer
kubectl get ns ingress-nginx
kubectl get svc -n ingress-nginx          # note the EXTERNAL-IP of the controller
kubectl get storageclass managed-csi
```

---

## Step 1 — Let AKS pull from the registry

The cluster's kubelet identity needs `AcrPull` on `regisry` so nodes can pull the
images:

```bash
az aks update --resource-group infosys --name infosys --attach-acr regisry
```

## Step 2 — Create the namespaces and apply guardrails

Namespaces, ResourceQuota, and LimitRange are **cluster-admin / platform
guardrails**, applied once at bootstrap (the deploy pipeline runs with a
namespace-scoped identity and cannot create or modify them — see Step 4):

```bash
for ns in adla-staging adla-production; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply -n "$ns" -f k8s/base/resource-quota.yaml -f k8s/base/limit-range.yaml
done
```

## Step 3 — Point DNS at the ingress

Create/confirm DNS **A records** pointing at the ingress-nginx external IP from
the prerequisites:

- `alda.audit.gov.gh` → `<ingress-nginx EXTERNAL-IP>`  (production — required)
- `ttaging-alda.audit.gov.gh` → `<ingress-nginx EXTERNAL-IP>`  (staging — temporary)

> cert-manager uses an HTTP-01 challenge, so the host **must** resolve to the
> ingress IP before a certificate can be issued. Until staging DNS exists, the
> staging certificate stays `Pending` and HTTPS uses a temporary/self-signed cert.

## Step 4 — Configure GitHub Actions OIDC (for CI/CD deploys)

Creates the Azure AD app + federated credentials, grants **least-privilege**
access, and prints the three values to register as GitHub secrets:

```bash
./infra/setup-github-oidc.sh          # defaults: RG/AKS=infosys, ACR=regisry
```

The deploy identity is scoped, **not** cluster-admin. The script grants:
- `AcrPush` on `regisry` (build-and-push),
- `Azure Kubernetes Service Cluster User Role` on the cluster (fetch the
  non-admin kubeconfig only — no data-plane power on its own),
- namespace-scoped Kubernetes admin on `adla-staging` + `adla-production`.

How that last grant is applied depends on the cluster's Kubernetes authz:
- **Azure RBAC for Kubernetes enabled** → the script assigns the
  *"Azure Kubernetes Service RBAC Admin"* role scoped to each namespace
  (`<aks-id>/namespaces/<ns>`) automatically.
- **Native Kubernetes RBAC** → the script prints `kubectl create rolebinding`
  commands; run them **as a cluster admin** to bind the SP to the built-in
  `admin` ClusterRole in each namespace, e.g.:
  ```bash
  kubectl create rolebinding adla-deployer -n adla-staging \
    --clusterrole=admin --user=<SP_OBJECT_ID>
  ```

Add the printed values as **repository secrets**
(`Settings → Secrets and variables → Actions`):

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Create the GitHub **Environments** (`Settings → Environments`):

- `staging`
- `production` — recommended: 1 required reviewer + a short wait timer (the
  release-triggered production deploy then waits for approval)

## Step 5 — Create the application secrets (per namespace)

Generates every boot-gate secret plus the in-cluster DB/Redis/MinIO credentials,
deriving `DATABASE_URL`/`REDIS_URL` from the generated values so they always match
the StatefulSets:

```bash
./infra/create-secrets.sh adla-staging
./infra/create-secrets.sh adla-production
```

This writes Secret `adla-secrets` containing: `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`ANALYTICS_IP_SALT`, `NOTIFICATIONS_SMS_WEBHOOK_SECRET`, `PII_ENCRYPTION_KEY`,
`PII_HMAC_KEY`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `POSTGRES_USER/PASSWORD/DB`,
`DATABASE_URL`, `REDIS_URL`, and (blank) `SMTP_USER/SMTP_PASS`.

> The script refuses to overwrite an existing `adla-secrets` (use `FORCE=1` only if
> you understand it will rotate `POSTGRES_PASSWORD`, which won't change an
> already-initialized Postgres PVC). Add SMTP later without rotating other keys:
>
> ```bash
> kubectl patch secret adla-secrets -n adla-staging --type merge \
>   -p '{"stringData":{"SMTP_USER":"...","SMTP_PASS":"..."}}'
> ```

## Step 6 — Deploy

### Option A — GitHub Actions (recommended)

The `Deploy` workflow runs `ci → build-and-push → deploy-data-tier → migrate →
deploy-app → smoke-test` and targets an environment based on the trigger:

```bash
# staging — merge a PR (or push) to main
git push origin main          # or merge the PR in the GitHub UI
```

```bash
# production — publish a GitHub Release once staging is verified
gh release create v1.0.0 --target main --title "v1.0.0" --notes "..."
# (or create the release from the GitHub UI → Releases → Draft a new release)
```

The release tag is the production deploy marker; images are built from the
release's target commit and tagged with its SHA.

The workflow:
1. builds & pushes `adla-app` and `adla-migrate` images (tagged with the commit SHA),
2. applies the **data tier + shared config** and waits for Postgres/Redis/MinIO to be Ready,
3. runs a uniquely-named Prisma migration Job against the ready database,
4. rolls out the app/worker onto the migrated DB,
5. smoke-tests `https://<host>/api/health` (tolerates DNS/cert lag).

### Option B — Manual (first-cut / fallback)

From an authenticated workstation, mirror the workflow ordering. Substitute
`<ns>`/`<overlay>` (`adla-staging`/`staging` or `adla-production`/`production`) and
a real image `<tag>`:

```bash
# 1. Build & push images (from app/)
az acr login --name regisry
docker build -f app/docker/Dockerfile --target production \
  -t regisry.azurecr.io/adla-app:<tag> app/
docker build -f app/docker/Dockerfile --target migration \
  -t regisry.azurecr.io/adla-migrate:<tag> app/
docker push regisry.azurecr.io/adla-app:<tag>
docker push regisry.azurecr.io/adla-migrate:<tag>

# 2. Pin the image tag in the overlay
cd k8s/overlays/<overlay>
kustomize edit set image \
  regisry.azurecr.io/adla-app=regisry.azurecr.io/adla-app:<tag> \
  regisry.azurecr.io/adla-migrate=regisry.azurecr.io/adla-migrate:<tag>
cd -

# 3. Apply ONLY the data tier + shared config, then wait for it to be Ready
kustomize build k8s/overlays/<overlay> > /tmp/adla.yaml
kubectl apply -f /tmp/adla.yaml \
  -l 'app.kubernetes.io/component in (database,cache,storage,infra)'
kubectl rollout status statefulset/adla-postgres -n <ns> --timeout=300s
kubectl rollout status statefulset/adla-redis    -n <ns> --timeout=300s
kubectl rollout status statefulset/adla-minio    -n <ns> --timeout=300s

# 4. Run the migration against the ready database. migration-job.yaml already has
#    envFrom (config+secret) and the part-of label; just substitute the image tag.
kubectl -n <ns> delete job adla-migrate --ignore-not-found
sed "s|adla-migrate:staging-latest|adla-migrate:<tag>|" k8s/base/migration-job.yaml \
  | kubectl -n <ns> apply -f -
kubectl -n <ns> wait --for=condition=complete job/adla-migrate --timeout=300s

# 5. Roll out the app/worker (and the rest of the overlay)
kubectl apply -f /tmp/adla.yaml
kubectl rollout status deployment/adla-app    -n <ns> --timeout=300s
kubectl rollout status deployment/adla-worker -n <ns> --timeout=300s

# 6. Restore the overlay (discard the image-tag mutation)
git checkout -- k8s/overlays/<overlay>/kustomization.yaml
```

---

## Step 7 — Verify

```bash
NS=adla-staging   # or adla-production

# Data tier up and PVCs bound
kubectl get statefulset,pvc,pod -n $NS

# App & worker healthy (no CrashLoopBackOff → if crashing, check the boot gate)
kubectl rollout status deployment/adla-app -n $NS
kubectl logs deploy/adla-app -n $NS --tail=50

# Connectivity from the app pod to the data tier
kubectl exec deploy/adla-app -n $NS -- sh -c \
  'nc -z adla-postgres 5432 && nc -z adla-redis 6379 && nc -z adla-minio 9000 && echo OK'

# Health endpoint (works before DNS via port-forward)
kubectl port-forward svc/adla-app 3000:3000 -n $NS &
curl -s localhost:3000/api/health ; kill %1

# TLS certificate (production should become Ready: True)
kubectl describe certificate adla-production-tls -n adla-production | grep -A3 Status:

# External
curl -I https://alda.audit.gov.gh/api/health
```

---

## Operations

**View logs**
```bash
kubectl logs -f deploy/adla-app -n <ns>
kubectl logs -f deploy/adla-worker -n <ns>
kubectl logs job/adla-migrate-<n> -n <ns>      # migration output
```

**Roll back the app** (to the previous ReplicaSet)
```bash
kubectl rollout undo deployment/adla-app -n <ns>
```

**Update a single secret value** (without rotating others)
```bash
kubectl patch secret adla-secrets -n <ns> --type merge \
  -p '{"stringData":{"SMTP_PASS":"..."}}'
kubectl rollout restart deployment/adla-app deployment/adla-worker -n <ns>
```

**Scale** — staging is pinned (HPA min=max=2); production HPA is 2–5 on 70% CPU.

**Grow a PVC** (Azure Disk supports expansion, not shrink)
```bash
kubectl edit pvc data-adla-postgres-0 -n <ns>   # raise spec.resources.requests.storage
```

---

## Known notes & follow-ups

- **The deploy identity is namespace-scoped, not cluster-admin** — it can manage
  workloads + NetworkPolicy in `adla-staging`/`adla-production` only. It cannot
  create namespaces or write ResourceQuota/LimitRange, so those are applied once
  at bootstrap (Step 2) by a cluster admin. Raising a quota later is a deliberate
  operator action, not something a compromised pipeline can do.
- **Staging host is `ttaging-alda.audit.gov.gh`** — a deliberate temporary match for
  the current (typo'd) DNS record. Correct it to `staging-alda.audit.gov.gh` in
  `overlays/staging/{ingress-patch,configmap-patch}.yaml` and `deploy.yml`'s
  `set-env` once DNS is fixed.
- **`/api/health` is shallow** (returns 200 without checking the DB) — readiness can
  go green before a request would actually succeed; the deploy ordering compensates.
- **Notifications are deferred** — SMTP/SMS are unconfigured for the first cut, so
  email/SMS sends fail/retry until real providers are added.
- **Backups are not yet configured** — add a `pg_dump` CronJob and/or Velero PVC
  snapshots before production go-live (single-replica StatefulSets have no HA).
- **`infra/provision.sh` / `teardown.sh` are deprecated** — they provision Azure
  *managed* Postgres/Redis/Blob, which this in-cluster architecture does not use.
```

## Seeding & bootstrapping

Migrations run automatically in the deploy pipeline. Seeding and admin
bootstrap are deliberate, operator-driven one-shots run with `infra/seed.sh`
(after `az aks get-credentials ...`):

```bash
# Reference data (roles, categories, institutions, offices, retention policies).
# Staging also gets the demo login accounts (password123); production does not.
infra/seed.sh staging reference
infra/seed.sh production reference

# Staging-only: load the 250-applicant demo dataset.
infra/seed.sh staging test-data        # production test-data is refused

# Production: provision the first admin. Set the creds in the Secret first:
kubectl patch secret adla-secrets -n adla-production --type merge \
  -p '{"stringData":{"BOOTSTRAP_ADMIN_EMAIL":"admin@audit.gov.gh","BOOTSTRAP_ADMIN_PASSWORD":"<strong-pw>"}}'
infra/seed.sh production bootstrap-admin   # re-running rotates the password
```

All seed/bootstrap Jobs reuse the `adla-migrate` image (it carries `tsx`,
`prisma/`, and `server/`). The reference manifests in `k8s/base/*-job.yaml` are
manual utilities, intentionally excluded from kustomize.
