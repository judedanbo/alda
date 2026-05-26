# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is a single Nuxt 4 application living in `app/`. The repo root only holds the dev docker-compose and planning docs — **all `npm`, `prisma`, `nuxt`, lint, and test commands must be run from `app/`**.

- `app/` — the Nuxt application (frontend + Nitro server routes)
- `docker-compose.dev.yml` — full local stack (Postgres, Redis, MinIO, MailHog, app container)
- `plans/asset-declaration-app.md` — the product/architecture plan; the source of truth for the workflow this codebase implements
- `docs/` — currently just the original flowchart PDF

## Common commands

Run from `app/` unless noted.

```bash
npm run dev              # Nuxt dev server (http://localhost:3000)
npm run build            # production build (output to .output/)
npm run lint             # ESLint (@nuxt/eslint flat config)

npm run db:generate      # regenerate Prisma client after schema.prisma changes
npm run db:migrate       # create+apply a dev migration
npm run db:reset         # drop DB, re-apply all migrations, and re-seed
npm run db:push          # push schema without a migration (prototype only)
npm run db:seed          # tsx prisma/seed.ts
npm run db:studio        # Prisma Studio GUI

npm run test:unit        # vitest (single file: npx vitest run path/to/file)
npm run test:e2e         # playwright

npm run db:seed:demo     # tsx prisma/seed-demo.ts (richer demo data)
npm run db:backfill:pii  # encrypt+hash existing national-ID rows; runs
                         # BETWEEN the two PII-encryption migrations on a
                         # system with pre-encryption data (no-op on fresh DBs)
```

The PII-encryption migration ships as two sequential migrations
(`20260526000000_pii_encryption_add_columns` and
`20260526010000_pii_encryption_drop_plaintext`). On a system with
existing applicant profiles, apply step 1, run `npm run db:backfill:pii`,
then apply step 2. On a fresh dev DB, `prisma migrate reset` runs both
back-to-back and the seed writes encrypted data directly.

The full local stack (use this instead of running pieces individually):

```bash
docker compose -f docker-compose.dev.yml up      # from repo root
```

This brings up Postgres on `:5432`, Redis on `:6379`, MinIO on `:9000`/`:9001`, MailHog UI on `:8025`, and the app on `:3000`. The app container mounts `./app` and runs `nuxt dev` against the in-network services. `minio-init` creates the `adla-uploads` bucket on first boot.

## What this app does

Asset Declaration Portal (ADLA) for Ghana's Article 286(5) compliance. Three actor types interact through a state-machine workflow:

- **Applicant** registers, uploads Ghana Card images, completes profile, then creates a `Declaration` (gets a unique code). Everything after that is officer-driven.
- **Schedule Officer** records form collection (`FormCollection`, capturing the `CollectionOffice` the physical form was collected from), records the returned form, records physical submission (`Submission`), reviews, and generates `Receipt`.
- **Legal Unit** verifies authenticity using the unique code, and processes lost-form reissue requests (records the offline Auditor General / Regional Auditor approval and reissues the form).
- **Admin** has access to everything plus audit logs, reports, user/institution management.

`Declaration.status` drives the workflow: `CODE_GENERATED → FORM_COLLECTED → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED → SEALED → COMPLETED`. The applicant only initiates the declaration (`CODE_GENERATED`); a Schedule Officer/Admin drives `FORM_COLLECTED` (form collected from a `CollectionOffice`), `SUBMITTED` (filled form returned), and every later transition. A rejection issues a new unique code and a fresh `CODE_GENERATED` declaration (the applicant cannot have another active declaration while one is `CODE_GENERATED`/`FORM_COLLECTED`/`SUBMITTED`/`UNDER_REVIEW` — see `app/server/api/declarations/index.post.ts`).

**Lost form reissue:** while a declaration is `FORM_COLLECTED`, if the applicant loses the physical form they can submit a tracked reissue request (`FormReissueRequest`, status `PENDING→APPROVED|DECLINED`) from the declaration detail page. The applicant takes an offline letter to the Auditor General or a Regional Auditor; once approved, a Legal Unit officer records the decision in one combined action (uploads the scanned approved letter, picks the approver, optional reasons) which reissues the form. The declaration **stays `FORM_COLLECTED`** throughout (no status change) — the applicant then returns the reissued form via the normal Form Return step. All requests/decisions are recorded and surface on the declaration timeline via `DeclarationStatusHistory`.

## Architecture: how the layers wire together

### Auth is enforced in two places, and they must stay aligned

1. **Server**: `app/server/middleware/auth.ts` runs on every request. It allow-lists public routes (`/api/auth/*` except `me`/`logout`, `/api/health`, `/api/categories`, `/api/institutions`), then requires a `Bearer` JWT for everything else. It sets `event.context.auth: JwtPayload` and enforces role prefixes (`/api/admin` → `admin`; `/api/officer` → `schedule_officer|admin`; `/api/legal` → `legal_unit|admin`). Server route handlers should read `event.context.auth` rather than re-verifying tokens.

2. **Client**: `app/middleware/auth.ts` is a Nuxt route middleware that uses the Pinia `auth` store to gate `/admin`, `/officer`, `/legal` page trees and redirect authenticated users away from `/auth/*`.

Token shape (`JwtPayload`): `{ userId, email, roles: string[] }`. Tokens are signed with `jwtSecret`/`jwtRefreshSecret` from `runtimeConfig` (see `nuxt.config.ts`). Helpers live in `app/server/utils/jwt.ts` — use `generateTokenPair`, `getAuthUser`, etc.; do not call `jsonwebtoken` directly elsewhere.

Roles in the system are exactly: `applicant`, `schedule_officer`, `legal_unit`, `admin`. Add new role checks by extending both middleware files together.

**Auth hardening that lives alongside the middleware**:

- `app/server/utils/auth-lockout.ts` — per-account login-failure counter + cool-down lock (10 failures in 15 min → 60-minute lock). `login.post.ts` consults it before the bcrypt compare; storage is the existing analytics KV (Redis or in-memory).
- `login.post.ts` runs `bcrypt.compare` against a constant dummy hash on the user-not-found path, so timing doesn't leak which emails exist.
- `RefreshToken` carries `familyId` + `consumedAt`. Refresh marks the old token consumed (no delete) and chains a new token in the same family. Presenting a consumed token wipes the family and audit-logs `REFRESH_TOKEN_REPLAY_DETECTED` — both the attacker and the legitimate client must re-authenticate.
- `server/utils/rate-limit.ts` no longer fails open when its KV throws; a tiny per-process Map applies conservative caps (auth: 5/min, write: 20/min, default: 60/min) so a Redis blip degrades to per-instance limits.
- `schedule_officer` users are scoped to specific `CollectionOffice`(s) via the `UserCollectionOffice` junction. `server/utils/officer-scope.ts` exports `assertOfficerCanActOnOffice` (body-supplied office) and `assertOfficerCanActOnDeclaration` (office derived from the declaration's most-recent `FormCollection`); call one or the other from every write endpoint a schedule officer can hit. Admins bypass; legal_unit is unaffected.

### Prisma client is a singleton

Always import via `import prisma from "~/server/utils/prisma"`. Constructing `new PrismaClient()` elsewhere will leak connections in dev (HMR re-imports). The singleton attaches itself to `globalThis` outside production for that reason.

The schema in `app/prisma/schema.prisma` uses `@map`/`@@map` to translate camelCase Prisma fields to snake_case Postgres columns — keep that convention when adding fields.

### Cross-cutting server concerns

State-changing endpoints follow a consistent pattern: validate auth → validate body → mutate via Prisma → write an audit log → trigger a notification. Use the shared utilities rather than reimplementing:

- **Request validation**: `app/server/utils/validators.ts` — `validateBody(event, schema)` parses `readBody()` against a Zod schema and throws a 400 with `error.flatten()` on failure. All Zod schemas for the domain live in this file; add new ones here rather than inline in route handlers.
- `app/server/utils/audit.ts` — `createAuditLog(event, { userId, action, entityType, entityId, oldValues?, newValues? })` plus an `AuditActions` enum. Call it on every state transition; `audit_logs` is a compliance requirement, not a debug aid.
- `app/server/utils/code-generator.ts` — `generateUniqueCode()` for declaration codes (with collision retry at the call site).
- `app/server/services/notification.service.ts` — high-level helpers like `notifyUniqueCodeGenerated`. The service fans out to `email.service.ts` / `sms.service.ts` based on `NotificationPreference` and writes `NotificationDeliveryLog` rows. Don't call `email.service` or `sms.service` directly from route handlers.
- `app/server/services/storage.service.ts` — MinIO uploads (Ghana Card images, receipt PDFs).
- `app/server/services/pdf.service.ts` — receipt generation via `pdf-lib`.

### Server middleware execution order

Nitro runs middleware in filename-sorted order. The three middleware files are deliberately named to enforce:

1. `00.security.ts` — IP-scoped security: operator blocks, AI crawler policy, per-IP and per-route-group rate limits. Runs first so floods are rejected before any JWT work. Uses Redis-backed analytics storage.
2. `auth.ts` — JWT authentication + role-based route protection. Sets `event.context.auth`.
3. `rate-limit-user.ts` — per-authenticated-user rate limit (needs `event.context.auth` from step 2).

All three fail-open on unexpected errors (intentional 403/429 propagate, internal errors are swallowed). When adding middleware, name it to fit this ordering.

### Analytics & traffic subsystem

A self-contained analytics pipeline lives entirely in `app/server/`:

- **Nitro plugin** `plugins/traffic.ts` — hooks `request` (classify visitor, sessionize) and `afterResponse` (capture traffic event, run abuse scorer). Adds zero user-facing latency because the capture runs after the response is sent.
- **Scheduled Nitro tasks** `tasks/analytics/rollup.ts` and `tasks/analytics/prune.ts` — roll raw events into hourly/daily aggregates (every 10 min) and prune past retention (daily at 03:30). Configured in `nuxt.config.ts` under `nitro.scheduledTasks`.
- **Storage** — Redis when `REDIS_URL` is set, otherwise in-memory (single-instance only). Accessed via `getAnalyticsStorage()` from `analytics-storage.ts`, never directly.
- **Configuration** — all thresholds live in `runtimeConfig.analytics` (see `nuxt.config.ts`). Read via `getAnalyticsConfig()` from `analytics-config.ts`, never via `useRuntimeConfig()` directly in analytics code.

The subsystem is toggled by `ANALYTICS_ENABLED`. Individual features (`captureEnabled`, `abuseEnabled`, `aiDetectionEnabled`, `rateLimitEnabled`) can be turned off independently.

### Frontend

- Pages are organized by role: `pages/applicant/`, `pages/officer/`, `pages/legal/`, `pages/admin/`. Auth pages under `pages/auth/`. Public pages (`index`, `contact`, `privacy`, `terms`) at the top level.
- Layouts: `default.vue` (public), `auth.vue` (login/register), `dashboard.vue` (post-login app shell).
- **API calls**: client-side code uses `authFetch()` from `app/utils/authFetch.ts` (or the reactive `useApiFetch()` composable). `authFetch` attaches the Bearer token, transparently retries on 401 with a single token refresh, and redirects to login on failure. Don't use raw `$fetch` or `useFetch` for authenticated endpoints.
- State: Pinia stores in `app/stores/` — `auth.ts` persists the token pair to `localStorage` under `adla_tokens` and exposes `isApplicant`/`isOfficer`/`isLegalUnit`/`isAdmin` computed flags used by both the client middleware and dashboard redirects.
- UI: shadcn-vue is configured (`shadcn-nuxt` module, `componentDir: ./components/ui`, `prefix: ""`). The directory is empty until you add components with `npx shadcn-vue@latest add <component>`.
- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`); main stylesheet is `app/assets/css/main.css`.
- TypeScript is strict (`typescript.strict: true` in `nuxt.config.ts`) and `future.compatibilityVersion: 4` is on — code should target Nuxt 4 idioms.

## Configuration

Secrets and infra come from env vars consumed in `nuxt.config.ts` `runtimeConfig`. `app/.env.example` lists every variable; `app/.env` is the local override. Server-only values (JWT secrets, DB URL, MinIO/SMTP creds) are at the top level of `runtimeConfig`; client-exposed values go under `runtimeConfig.public`. Never read these via `process.env` in handlers — use `useRuntimeConfig()`.
