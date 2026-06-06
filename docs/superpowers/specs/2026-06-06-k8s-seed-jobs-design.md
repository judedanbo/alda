# Kubernetes seed & bootstrap Jobs — design

**Date:** 2026-06-06
**Status:** Approved for planning

## Problem

The deploy pipeline (`deploy.yml`) already runs database **migrations** as a
uniquely-named per-run Kubernetes Job (`prisma migrate deploy`). What's missing
is a repeatable way to **seed** the two environments:

- **Production** needs its reference data (roles, public-office categories,
  institutions, collection offices, retention policies) and a single real,
  login-able **admin** user — without the hardcoded demo accounts.
- **Staging** needs the same reference data **plus** the convenient demo login
  accounts and the richer 250-applicant test dataset, so it can be exercised
  end-to-end.

Today the only seeders are `prisma/seed.ts` (reference data + demo accounts) and
`prisma/seed-demo.ts` (250 fictional applicants), both runnable only via
`npm run db:seed*` on a workstation. There is no Kubernetes Job to run them
against the in-cluster databases, and no production-safe way to create the first
admin.

## Constraints discovered

1. **The migration image cannot run the seeds as-is.** Both seed scripts
   `import "../server/utils/pii-encryption"`, but the `migration` Docker stage
   copies only `prisma/` + `node_modules` + `package.json` — not `server/`. A
   seed Job on today's image crashes at import resolution.
2. **No natural unique keys for the reference models.** `Institution`,
   `CollectionOffice`, and `DataRetentionPolicy` have no `@unique` on the seeded
   fields (only an autouuid/autoincrement `id`). `seed.ts` creates them with
   `.create()`, so a second run (or a Job retry) throws unique/duplicate errors.
   Idempotency must be a find-first-then-create guard, **not** a schema
   migration.
3. **`NODE_ENV` gates seed behavior, and every environment runs as
   `production`.** The base configmap sets `NODE_ENV=production` and neither
   overlay overrides it. Both seed scripts (a) refuse to run in production
   unless `ALLOW_SEED_IN_PRODUCTION=true` (`assertNotProduction`), and (b)
   `seed.ts` skips demo-account creation when `NODE_ENV=production`. A Pod's
   explicit `env:` entries override `envFrom:`, so each Job can set its own
   `NODE_ENV` / `ALLOW_SEED_IN_PRODUCTION` without touching the shared configmap.
4. **Jobs are deliberately kept out of kustomize.** `migration-job.yaml` and
   `minio-init-job.yaml` are reference manifests excluded from
   `kustomization.yaml` because Jobs are immutable and the overlay is applied
   repeatedly per deploy. New seed Jobs follow the same convention.

## Invocation model

**Hybrid.** Migration stays auto-run in CI. The seed Jobs are operator-driven
one-shots:

- **Reference seed** — a deliberate one-shot per environment (bootstrap and
  whenever reference data changes).
- **Bootstrap admin** — a deliberate one-shot in production (and re-runnable to
  rotate the admin password).
- **Staging test-data** — on-demand, when an operator wants fresh demo data.
  Refused against production.

## Components

### 1. Image — extend the `migration` stage into a migrate+seed image

In `app/docker/Dockerfile`, the `migration` target gains:

```dockerfile
COPY --from=builder /app/server ./server
```

so the seed scripts resolve `../server/utils/pii-encryption`. The stage already
carries the full `node_modules` (including `tsx`), `prisma/`, and
`package.json`. The default `CMD` stays `["npx", "prisma", "migrate", "deploy"]`;
seed Jobs override `command`. No new CI image is built — `adla-migrate` is
already built and pushed by `deploy.yml`.

### 2. `seed.ts` — make reference seeding idempotent

Guard the `.create()` calls for institutions, collection offices, and data
retention policies with a find-first-then-create check (skip if a matching row
already exists). Roles and public-office categories already upsert. No schema
change. Result: the reference seed is safe to run any number of times.

### 3. Bootstrap admin — new `prisma/bootstrap-admin.ts`

A single-purpose script, separate from `seed.ts`:

- Reads `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from the
  environment (sourced from `adla-secrets`). Exits non-zero with a clear message
  if either is missing.
- Ensures the `admin` role exists, bcrypt-hashes the password (cost 12, matching
  `seed.ts`), and **upserts** one user by email — idempotent, so re-running
  rotates the password rather than erroring.
- Creates the user's `NotificationPreference` row (matching `seed.ts`).
- Intended for production, so it does **not** refuse on `NODE_ENV=production`. It
  is independent of `seed.ts` so reference seeding and admin provisioning are
  separate, re-runnable concerns.

### 4. Job manifests — `k8s/base/`, excluded from `kustomization.yaml`

Three reference manifests, mirroring the existing `migration-job.yaml` style
(labels baked in for NetworkPolicy admission, documented as manual utilities):

| File | Command | Use |
|------|---------|-----|
| `seed-reference-job.yaml` | `tsx prisma/seed.ts` | reference data (both envs) |
| `seed-test-data-job.yaml` | `tsx prisma/seed-demo.ts` | demo dataset (staging only) |
| `bootstrap-admin-job.yaml` | `tsx prisma/bootstrap-admin.ts` | first admin (prod) |

Common spec for all three:

- Labels: `app.kubernetes.io/part-of: adla`, `app.kubernetes.io/component:
  seed` (or `bootstrap`), plus a per-job `name` label.
- `image: regisry.azurecr.io/adla-migrate:latest` (operator/script overrides the
  tag).
- `restartPolicy: Never`, `backoffLimit: 0` (the scripts are idempotent, but we
  do not want a surprise retry mutating data), `ttlSecondsAfterFinished: 300`.
- `envFrom:` the `adla-config` configmap and `adla-secrets` secret (provides
  `DATABASE_URL`, etc.), plus per-job `env:` overrides described below.
- Resource requests/limits matching the migration Job (128m/256Mi →
  256m/512Mi).

The manifests document, in a header comment, that they are manual utilities run
via `infra/seed.sh` (or `kubectl apply` by hand) and are intentionally not in the
kustomization.

### 5. Helper — `infra/seed.sh <env> <kind>`

`infra/seed.sh <staging|production> <reference|test-data|bootstrap-admin>`:

- Maps env → namespace (`adla-staging` / `adla-production`).
- **Refuses** `production test-data` outright.
- Env overrides per (env, kind):
  - prod + `reference` → `ALLOW_SEED_IN_PRODUCTION=true` (NODE_ENV stays
    `production` → reference data only, no demo accounts).
  - prod + `bootstrap-admin` → no override needed.
  - staging + `reference`/`test-data` → `NODE_ENV=staging` (guards pass; demo
    accounts and demo data are created without `ALLOW_SEED_IN_PRODUCTION`).
- Resolves the current image tag (defaults to `<overlay>-latest`, overridable).
- Stamps a uniquely-named Job (e.g. `adla-seed-reference-<timestamp>`), applies
  it (deleting any prior Job of that name first), `kubectl wait
  --for=condition=complete --timeout=...`, then tails the Job's logs and reports
  pass/fail. Mirrors the inline-Job pattern in `deploy.yml` and the `infra/*.sh`
  convention.

### 6. Wiring & docs

- Add `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` to
  `infra/create-secrets.sh` (prompted/optional) and to `app/.env.example`.
- Document the seed/bootstrap workflow in `k8s/README.md`.

## Data flow

```
operator ──► infra/seed.sh <env> <kind>
                │  (az aks get-credentials assumed already done, like deploy.yml)
                ├─ pick namespace, apply env overrides, resolve image tag
                ├─ kubectl apply  (unique Job name, envFrom config+secrets + env overrides)
                ▼
        Job Pod (adla-migrate image)
                │  tsx prisma/<seed|seed-demo|bootstrap-admin>.ts
                │  new PrismaClient() → DATABASE_URL from adla-secrets
                ▼
        Postgres (in-namespace statefulset)
                ▲
        kubectl wait --for=condition=complete  ◄── script blocks, then tails logs
```

## Testing

- **Unit:** `prisma/bootstrap-admin.ts` — missing-env exits non-zero; upsert
  creates then updates (idempotent); password is bcrypt-hashed. Reference-seed
  idempotency guards — run `seed.ts` twice against a test DB, second run is a
  no-op (no duplicate-key error, no duplicate rows). Use the existing vitest
  setup against a disposable database.
- **Manual / e2e:** on a scratch namespace, run each `infra/seed.sh` path and
  confirm: prod reference → reference rows present, zero demo users; staging
  reference → demo users present; staging test-data → 250 applicants;
  bootstrap-admin → one admin, second run rotates password; `production
  test-data` → refused.
- **Lint:** `npm run lint` for the new TS; `kustomize build k8s/overlays/<env>`
  still renders (the new Job manifests must stay out of the build).

## Out of scope

- Schema migrations to add unique constraints on reference models (idempotency
  is achieved with guards instead).
- Wiring any seed into the automatic deploy pipeline (explicitly operator-driven
  per the hybrid model).
- Changing how migrations run (already in place).
