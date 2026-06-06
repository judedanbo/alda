# Kubernetes Seed & Bootstrap Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operator-driven Kubernetes Jobs (plus a helper script) to seed reference data, bootstrap a production admin, and load staging test data against the in-cluster databases.

**Architecture:** Reuse the existing `adla-migrate` Docker image (extended to carry `server/`) to run the TS seed scripts as one-shot Jobs. Reference data seeding is made idempotent in place; a new isolated `bootstrap-admin.ts` provisions the first prod admin from Secret-sourced env. Three reference Job manifests live in `k8s/base/` (excluded from kustomize, like the existing `migration-job.yaml`), driven by an `infra/seed.sh <env> <kind>` wrapper that injects the right `NODE_ENV` / `ALLOW_SEED_IN_PRODUCTION` overrides per environment.

**Tech Stack:** Prisma 6 + `tsx`, `bcryptjs`, Kubernetes Jobs, Kustomize, Bash, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-06-k8s-seed-jobs-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `app/prisma/seed.ts` | Reference data + (non-prod) demo accounts | Modify — guard institutions & retention-policy creates |
| `app/prisma/bootstrap-admin.ts` | Provision one prod admin from env | Create |
| `app/test/bootstrap-admin.test.ts` | Unit tests for the above | Create |
| `app/docker/Dockerfile` | migrate+seed image | Modify — copy `server/` into `migration` stage |
| `k8s/base/seed-reference-job.yaml` | Job: `tsx prisma/seed.ts` | Create |
| `k8s/base/seed-test-data-job.yaml` | Job: `tsx prisma/seed-demo.ts` | Create |
| `k8s/base/bootstrap-admin-job.yaml` | Job: `tsx prisma/bootstrap-admin.ts` | Create |
| `infra/seed.sh` | Operator wrapper that stamps + runs a Job | Create |
| `infra/create-secrets.sh` | Cluster Secret creation | Modify — add bootstrap-admin keys |
| `app/.env.example` | Documented env vars | Modify — add bootstrap-admin keys |
| `k8s/README.md` | Ops docs | Modify — document seed workflow |

**Conventions to follow (verified in the codebase):**
- Seed scripts construct `new PrismaClient()` directly (not the `~/server/utils/prisma` singleton) and end with `main().then(...).catch(...)`.
- The intentional registry spelling is `regisry.azurecr.io` (matches `migration-job.yaml` and the overlays — do **not** "fix" it).
- The find-first-then-create idempotency pattern already exists in `seed.ts` for collection offices — mirror it exactly.
- Tests mock Prisma with `vi.fn()` doubles (see `app/test/officer-scope.test.ts`).

---

## Task 1: Make reference-data seeding idempotent

`seed.ts` creates institutions and data-retention policies with bare `.create()`, so a second run (or a Job retry) throws. Collection offices already use a find-first-then-create guard — apply the same pattern to the other two.

**Files:**
- Modify: `app/prisma/seed.ts` (institutions loop ~`178-183`, retention-policies loop ~`238-243`)

- [ ] **Step 1: Guard the institutions create loop**

Replace this block in `app/prisma/seed.ts`:

```ts
  for (const institution of institutions) {
    await prisma.institution.create({
      data: institution,
    });
  }
  console.log(`✅ Created ${institutions.length} institutions`);
```

with:

```ts
  let institutionsCreated = 0;
  for (const institution of institutions) {
    const existing = await prisma.institution.findFirst({
      where: { name: institution.name },
    });
    if (!existing) {
      await prisma.institution.create({ data: institution });
      institutionsCreated++;
    }
  }
  console.log(`✅ Created ${institutionsCreated} institutions`);
```

- [ ] **Step 2: Guard the data-retention-policies create loop**

Replace this block in `app/prisma/seed.ts`:

```ts
  for (const policy of retentionPolicies) {
    await prisma.dataRetentionPolicy.create({
      data: policy,
    });
  }
  console.log(`✅ Created ${retentionPolicies.length} data retention policies`);
```

with:

```ts
  let retentionPoliciesCreated = 0;
  for (const policy of retentionPolicies) {
    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: { entityType: policy.entityType },
    });
    if (!existing) {
      await prisma.dataRetentionPolicy.create({ data: policy });
      retentionPoliciesCreated++;
    }
  }
  console.log(`✅ Created ${retentionPoliciesCreated} data retention policies`);
```

- [ ] **Step 3: Lint**

Run: `cd app && npm run lint`
Expected: PASS (no new errors).

- [ ] **Step 4: Verify idempotency against a dev DB (if reachable)**

Note: `seed.ts` is not import-structured, so this is verified by double-run rather than a unit test (matching how the existing collection-offices guard is verified).

Prerequisite — a Postgres is reachable on `DATABASE_URL`. If not already up, from the repo root:
```bash
docker compose -f docker-compose.dev.yml up -d postgres
```
Then:
```bash
cd app
npm run db:reset       # clean DB + first seed
npm run db:seed        # second seed — the run under test
```
Expected: the second run completes with exit 0 and logs `✅ Created 0 institutions` and `✅ Created 0 data retention policies` (no unique/duplicate error).

If no DB is reachable in this environment, record that and rely on the lint + code review of Steps 1–2.

- [ ] **Step 5: Commit**

```bash
git add app/prisma/seed.ts
git commit -m "fix(seed): make institution & retention-policy seeding idempotent"
```

---

## Task 2: Bootstrap-admin script (TDD)

A single-purpose, prod-safe script that provisions exactly one admin from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (and optional `BOOTSTRAP_ADMIN_PHONE`). It exports pure functions so it is unit-testable with a mocked Prisma, and only runs `main()` when executed directly (so importing it in a test does not hit a database).

**Files:**
- Create: `app/prisma/bootstrap-admin.ts`
- Test: `app/test/bootstrap-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/test/bootstrap-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { readBootstrapEnv, bootstrapAdmin } from "../prisma/bootstrap-admin";

const roleUpsert = vi.fn();
const userUpsert = vi.fn();
const notifUpsert = vi.fn();

const mockPrisma = {
  role: { upsert: roleUpsert },
  user: { upsert: userUpsert },
  notificationPreference: { upsert: notifUpsert },
} as unknown as Parameters<typeof bootstrapAdmin>[0];

beforeEach(() => {
  roleUpsert.mockReset().mockResolvedValue({ id: 1, name: "admin" });
  userUpsert.mockReset().mockResolvedValue({ id: "admin-uuid", email: "a@b.gov.gh" });
  notifUpsert.mockReset().mockResolvedValue({});
});

describe("readBootstrapEnv", () => {
  it("throws when the email is missing", () => {
    expect(() => readBootstrapEnv({ BOOTSTRAP_ADMIN_PASSWORD: "pw" })).toThrow(
      /BOOTSTRAP_ADMIN_EMAIL/,
    );
  });

  it("throws when the password is missing", () => {
    expect(() => readBootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: "a@b.gov.gh" })).toThrow(
      /BOOTSTRAP_ADMIN_PASSWORD/,
    );
  });

  it("returns trimmed email, password, and optional phone", () => {
    const opts = readBootstrapEnv({
      BOOTSTRAP_ADMIN_EMAIL: "  a@b.gov.gh ",
      BOOTSTRAP_ADMIN_PASSWORD: "secret-pw",
      BOOTSTRAP_ADMIN_PHONE: "+233200000000",
    });
    expect(opts).toEqual({
      email: "a@b.gov.gh",
      password: "secret-pw",
      phone: "+233200000000",
    });
  });
});

describe("bootstrapAdmin", () => {
  it("ensures the admin role exists, then upserts the user by email", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    expect(roleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "admin" } }),
    );
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "a@b.gov.gh" } }),
    );
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    const arg = userUpsert.mock.calls[0][0];
    const hash = arg.create.passwordHash;
    expect(hash).not.toBe("secret-pw");
    expect(bcrypt.compareSync("secret-pw", hash)).toBe(true);
  });

  it("rotates the password on re-run (update also sets the hash)", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "new-pw" });

    const arg = userUpsert.mock.calls[0][0];
    expect(bcrypt.compareSync("new-pw", arg.update.passwordHash)).toBe(true);
  });

  it("creates the notification preference for the admin", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    expect(notifUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "admin-uuid" } }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run test/bootstrap-admin.test.ts`
Expected: FAIL — cannot resolve `../prisma/bootstrap-admin` (module does not exist yet).

- [ ] **Step 3: Implement the script**

Create `app/prisma/bootstrap-admin.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

/**
 * Provision exactly one `admin` user from the environment. Unlike prisma/seed.ts,
 * this is MEANT to run in production: it has no demo accounts and no
 * NODE_ENV guard. Credentials come from BOOTSTRAP_ADMIN_EMAIL /
 * BOOTSTRAP_ADMIN_PASSWORD (sourced from the adla-secrets Secret). Idempotent —
 * re-running rotates the admin's password rather than erroring.
 */

const BCRYPT_COST = 12; // matches prisma/seed.ts

export interface BootstrapAdminOptions {
  email: string;
  password: string;
  phone?: string;
}

/** Parse + validate the bootstrap env; throws a clear error if a required value is absent. */
export function readBootstrapEnv(env: NodeJS.ProcessEnv): BootstrapAdminOptions {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim();

  if (!email) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required but was not set.");
  }
  if (!password) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required but was not set.");
  }

  return { email, password, ...(phone ? { phone } : {}) };
}

/** Minimal Prisma surface this function needs — keeps it unit-testable with a mock. */
type AdminPrisma = Pick<PrismaClient, "role" | "user" | "notificationPreference">;

export async function bootstrapAdmin(
  prisma: AdminPrisma,
  opts: BootstrapAdminOptions,
): Promise<void> {
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin", description: "System administrator with full access" },
  });

  const passwordHash = await bcrypt.hash(opts.password, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: { passwordHash },
    create: {
      email: opts.email,
      passwordHash,
      phone: opts.phone ?? null,
      emailVerified: true,
      roles: {
        create: { roleId: adminRole.id },
      },
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    },
  });
}

async function main(): Promise<void> {
  const opts = readBootstrapEnv(process.env);
  const prisma = new PrismaClient();
  try {
    await bootstrapAdmin(prisma, opts);
    console.log(`✅ Bootstrap admin ready: ${opts.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (`tsx prisma/bootstrap-admin.ts`), so importing
// this module in a test never touches a database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("❌ Bootstrap admin error:", e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run test/bootstrap-admin.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Lint**

Run: `cd app && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/prisma/bootstrap-admin.ts app/test/bootstrap-admin.test.ts
git commit -m "feat(seed): add idempotent bootstrap-admin script"
```

---

## Task 3: Extend the migration image to carry `server/`

The seed scripts `import "../server/utils/pii-encryption"`, which the `migration` Docker stage does not currently copy. Add it so the one image can run migrations and all three seed scripts.

**Files:**
- Modify: `app/docker/Dockerfile` (the `migration` stage)

- [ ] **Step 1: Copy `server/` into the migration stage**

In `app/docker/Dockerfile`, find the `migration` stage:

```dockerfile
FROM node:24-alpine AS migration

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

CMD ["npx", "prisma", "migrate", "deploy"]
```

Add a `server/` copy and a clarifying comment so it reads:

```dockerfile
# Migration + seed stage — used by the K8s migration Job (default CMD) and by the
# seed Jobs (which override the command to run tsx prisma/<seed>.ts). server/ is
# required because the seed scripts import ../server/utils/pii-encryption.
FROM node:24-alpine AS migration

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

CMD ["npx", "prisma", "migrate", "deploy"]
```

- [ ] **Step 2: Build the migration stage and verify `server/` is present (if docker is available)**

Run (from repo root):
```bash
docker build -f app/docker/Dockerfile --target migration -t adla-migrate:planverify app/
docker run --rm adla-migrate:planverify sh -c "ls prisma/seed.ts prisma/seed-demo.ts prisma/bootstrap-admin.ts server/utils/pii-encryption.ts"
```
Expected: the build succeeds and the second command lists all four files with no "No such file" error.

If docker is unavailable in this environment, record that and rely on review of the `COPY` line against the seed scripts' import paths.

- [ ] **Step 3: Commit**

```bash
git add app/docker/Dockerfile
git commit -m "build(docker): copy server/ into migration stage so seeds resolve imports"
```

---

## Task 4: Job manifests

Three reference manifests in `k8s/base/`, modeled on `migration-job.yaml`: labels baked in for NetworkPolicy admission, documented as manual utilities, and intentionally **not** added to `kustomization.yaml`. The per-environment env overrides are applied by `infra/seed.sh` (Task 5), not baked here.

**Files:**
- Create: `k8s/base/seed-reference-job.yaml`
- Create: `k8s/base/seed-test-data-job.yaml`
- Create: `k8s/base/bootstrap-admin-job.yaml`

- [ ] **Step 1: Create `k8s/base/seed-reference-job.yaml`**

```yaml
# Manual utility — seeds reference data (roles, public-office categories,
# institutions, collection offices, retention policies). Run it via
# infra/seed.sh, which stamps a unique name and injects the right env overrides:
#   infra/seed.sh staging reference      # NODE_ENV=staging -> also creates demo users
#   infra/seed.sh production reference    # ALLOW_SEED_IN_PRODUCTION=true -> reference only
# Intentionally NOT in kustomization.yaml (Jobs are immutable; the overlay is
# applied repeatedly per deploy). part-of: adla is baked in so the NetworkPolicy
# admits the pod to reach Postgres when applied directly.
apiVersion: batch/v1
kind: Job
metadata:
  name: adla-seed-reference
  labels:
    app.kubernetes.io/name: adla-seed-reference
    app.kubernetes.io/component: seed
    app.kubernetes.io/part-of: adla
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-seed-reference
        app.kubernetes.io/component: seed
        app.kubernetes.io/part-of: adla
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: regisry.azurecr.io/adla-migrate:latest
          command: ["npx", "tsx", "prisma/seed.ts"]
          envFrom:
            - configMapRef:
                name: adla-config
            - secretRef:
                name: adla-secrets
          resources:
            requests:
              cpu: 128m
              memory: 256Mi
            limits:
              cpu: 256m
              memory: 512Mi
```

- [ ] **Step 2: Create `k8s/base/seed-test-data-job.yaml`**

```yaml
# Manual utility — loads the 250-applicant demo dataset (prisma/seed-demo.ts).
# STAGING ONLY: infra/seed.sh refuses to run this against production. Run via:
#   infra/seed.sh staging test-data
# Intentionally NOT in kustomization.yaml. part-of: adla baked in for NetworkPolicy.
apiVersion: batch/v1
kind: Job
metadata:
  name: adla-seed-test-data
  labels:
    app.kubernetes.io/name: adla-seed-test-data
    app.kubernetes.io/component: seed
    app.kubernetes.io/part-of: adla
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-seed-test-data
        app.kubernetes.io/component: seed
        app.kubernetes.io/part-of: adla
    spec:
      restartPolicy: Never
      containers:
        - name: seed-demo
          image: regisry.azurecr.io/adla-migrate:latest
          command: ["npx", "tsx", "prisma/seed-demo.ts"]
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
              cpu: 512m
              memory: 1Gi
```

- [ ] **Step 3: Create `k8s/base/bootstrap-admin-job.yaml`**

```yaml
# Manual utility — provisions one real admin user (prisma/bootstrap-admin.ts) from
# BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD in adla-secrets. Idempotent:
# re-running rotates the admin password. Run via:
#   infra/seed.sh production bootstrap-admin
# (set BOOTSTRAP_ADMIN_* in adla-secrets first — see infra/create-secrets.sh).
# Intentionally NOT in kustomization.yaml. part-of: adla baked in for NetworkPolicy.
apiVersion: batch/v1
kind: Job
metadata:
  name: adla-bootstrap-admin
  labels:
    app.kubernetes.io/name: adla-bootstrap-admin
    app.kubernetes.io/component: bootstrap
    app.kubernetes.io/part-of: adla
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: adla-bootstrap-admin
        app.kubernetes.io/component: bootstrap
        app.kubernetes.io/part-of: adla
    spec:
      restartPolicy: Never
      containers:
        - name: bootstrap-admin
          image: regisry.azurecr.io/adla-migrate:latest
          command: ["npx", "tsx", "prisma/bootstrap-admin.ts"]
          envFrom:
            - configMapRef:
                name: adla-config
            - secretRef:
                name: adla-secrets
          resources:
            requests:
              cpu: 128m
              memory: 256Mi
            limits:
              cpu: 256m
              memory: 512Mi
```

- [ ] **Step 4: Validate the manifests parse as Kubernetes objects**

Run (from repo root), for each file:
```bash
kubectl apply --dry-run=client -f k8s/base/seed-reference-job.yaml
kubectl apply --dry-run=client -f k8s/base/seed-test-data-job.yaml
kubectl apply --dry-run=client -f k8s/base/bootstrap-admin-job.yaml
```
Expected: each prints `job.batch/<name> created (dry run)` with no schema error.

If `kubectl` is unavailable, fall back to a YAML parse check:
```bash
for f in k8s/base/seed-reference-job.yaml k8s/base/seed-test-data-job.yaml k8s/base/bootstrap-admin-job.yaml; do
  python3 -c "import yaml,sys; list(yaml.safe_load_all(open('$f'))); print('ok', '$f')"
done
```
Expected: `ok <file>` for all three.

- [ ] **Step 5: Confirm the new Jobs stay OUT of the kustomize build**

Run (from repo root):
```bash
kustomize build k8s/overlays/staging | grep -c "adla-seed-reference\|adla-seed-test-data\|adla-bootstrap-admin" || true
```
Expected: `0` (the seed/bootstrap Jobs must not appear in the rendered overlay).

- [ ] **Step 6: Commit**

```bash
git add k8s/base/seed-reference-job.yaml k8s/base/seed-test-data-job.yaml k8s/base/bootstrap-admin-job.yaml
git commit -m "feat(k8s): add reference, test-data, and bootstrap-admin Job manifests"
```

---

## Task 5: `infra/seed.sh` helper

An operator wrapper mirroring the inline-Job pattern in `deploy.yml`'s migrate step: pick namespace by env, refuse `production test-data`, inject env overrides, stamp a unique Job name, apply, wait, tail logs. The env overrides are added as a `kubectl patch`-style strategic merge via a here-doc Job (so `env:` overrides the configmap's `NODE_ENV`).

**Files:**
- Create: `infra/seed.sh`

- [ ] **Step 1: Write the script**

Create `infra/seed.sh`:

```bash
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
```

Note on the `env:$EXTRA_ENV` block: when `EXTRA_ENV` is empty the rendered line is `env:` with no items, which Kubernetes accepts as an empty (null) env list.

- [ ] **Step 2: Make it executable**

Run: `chmod +x infra/seed.sh`

- [ ] **Step 3: Syntax-check the script**

Run (from repo root): `bash -n infra/seed.sh`
Expected: no output, exit 0. If `shellcheck` is installed, also run `shellcheck infra/seed.sh` and address any errors (warnings about `EXTRA_ENV` word-splitting are expected/intentional here).

- [ ] **Step 4: Verify the production test-data guard refuses without touching a cluster**

Run (from repo root): `infra/seed.sh production test-data; echo "exit=$?"`
Expected: prints `ERROR: refusing to load test data into production.` and `exit=3` (the guard runs before any `kubectl` call).

- [ ] **Step 5: Verify argument validation**

Run: `infra/seed.sh bogus reference; echo "exit=$?"`
Expected: prints the environment error and `exit=2`.

Run: `infra/seed.sh staging bogus; echo "exit=$?"`
Expected: prints the kind error and `exit=2`.

- [ ] **Step 6: Commit**

```bash
git add infra/seed.sh
git commit -m "feat(infra): add seed.sh helper to run seed/bootstrap Jobs"
```

---

## Task 6: Wire secrets, env example, and docs

Make the bootstrap-admin credentials available in the cluster Secret and documented, and document the seed workflow.

**Files:**
- Modify: `infra/create-secrets.sh`
- Modify: `app/.env.example`
- Modify: `k8s/README.md`

- [ ] **Step 1: Add bootstrap-admin keys to `create-secrets.sh`**

In `infra/create-secrets.sh`, after the SMTP block:

```bash
# Optional SMTP creds (not boot-gated; leave blank to defer email).
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
```

add:

```bash
# Optional bootstrap admin (consumed by prisma/bootstrap-admin.ts via the
# bootstrap-admin Job). Leave blank here and patch them in just before running
# `infra/seed.sh production bootstrap-admin`, or export them before this script.
BOOTSTRAP_ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-}"
BOOTSTRAP_ADMIN_PASSWORD="${BOOTSTRAP_ADMIN_PASSWORD:-}"
```

Then add two `--from-literal` lines to the `kubectl create secret generic` command, after the `SMTP_PASS` line:

```bash
  --from-literal="SMTP_PASS=${SMTP_PASS}" \
  --from-literal="BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL}" \
  --from-literal="BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Finally, extend the closing help text. Replace:

```bash
echo "SMTP_USER/SMTP_PASS are blank — add them later WITHOUT rotating other keys:"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"SMTP_USER\":\"...\",\"SMTP_PASS\":\"...\"}}'"
```

with:

```bash
echo "SMTP_USER/SMTP_PASS are blank — add them later WITHOUT rotating other keys:"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"SMTP_USER\":\"...\",\"SMTP_PASS\":\"...\"}}'"
echo ""
echo "BOOTSTRAP_ADMIN_EMAIL/PASSWORD are blank — set them before bootstrapping the"
echo "first admin (infra/seed.sh production bootstrap-admin):"
echo "  kubectl patch secret adla-secrets -n $NAMESPACE --type merge \\"
echo "    -p '{\"stringData\":{\"BOOTSTRAP_ADMIN_EMAIL\":\"...\",\"BOOTSTRAP_ADMIN_PASSWORD\":\"...\"}}'"
```

- [ ] **Step 2: Syntax-check create-secrets.sh**

Run (from repo root): `bash -n infra/create-secrets.sh`
Expected: no output, exit 0.

- [ ] **Step 3: Add the keys to `app/.env.example`**

In `app/.env.example`, find the `NODE_ENV="development"` line (~line 34) and add directly below it:

```bash
# Bootstrap admin — consumed by prisma/bootstrap-admin.ts to provision the first
# real admin user (used by the K8s bootstrap-admin Job). Leave blank locally.
BOOTSTRAP_ADMIN_EMAIL=""
BOOTSTRAP_ADMIN_PASSWORD=""
# Optional phone for the bootstrap admin (E.164, e.g. +233200000000).
BOOTSTRAP_ADMIN_PHONE=""
```

- [ ] **Step 4: Document the workflow in `k8s/README.md`**

Append a new section to `k8s/README.md`:

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add infra/create-secrets.sh app/.env.example k8s/README.md
git commit -m "docs(infra): wire bootstrap-admin secret + document seed workflow"
```

---

## Final verification

- [ ] **Run the full unit suite**

Run: `cd app && npm run test:unit -- --run`
Expected: PASS, including `test/bootstrap-admin.test.ts`.

- [ ] **Lint the whole app**

Run: `cd app && npm run lint`
Expected: PASS.

- [ ] **Confirm the overlays still render and exclude the Jobs**

Run (from repo root):
```bash
kustomize build k8s/overlays/staging >/dev/null && echo "staging ok"
kustomize build k8s/overlays/production >/dev/null && echo "production ok"
```
Expected: `staging ok` and `production ok`, no errors.
