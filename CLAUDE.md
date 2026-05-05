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
npm run db:push          # push schema without a migration (prototype only)
npm run db:seed          # tsx prisma/seed.ts
npm run db:studio        # Prisma Studio GUI

npm run test:unit        # vitest (single file: npx vitest run path/to/file)
npm run test:e2e         # playwright
```

The full local stack (use this instead of running pieces individually):

```bash
docker compose -f docker-compose.dev.yml up      # from repo root
```

This brings up Postgres on `:5432`, Redis on `:6379`, MinIO on `:9000`/`:9001`, MailHog UI on `:8025`, and the app on `:3000`. The app container mounts `./app` and runs `nuxt dev` against the in-network services. `minio-init` creates the `adla-uploads` bucket on first boot.

## What this app does

Asset Declaration Portal (ADLA) for Ghana's Article 286(5) compliance. Three actor types interact through a state-machine workflow:

- **Applicant** registers, uploads Ghana Card images, completes profile, then creates a `Declaration` (gets a unique code).
- **Schedule Officer** records physical submission (`Submission`), reviews, and generates `Receipt`.
- **Legal Unit** verifies authenticity using the unique code.
- **Admin** has access to everything plus audit logs, reports, user/institution management.

`Declaration.status` drives the workflow: `PENDING → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED → SEALED`. A rejection issues a new unique code (the applicant cannot have another active declaration while one is `PENDING`/`SUBMITTED`/`UNDER_REVIEW` — see `app/server/api/declarations/index.post.ts`).

## Architecture: how the layers wire together

### Auth is enforced in two places, and they must stay aligned

1. **Server**: `app/server/middleware/auth.ts` runs on every request. It allow-lists public routes (`/api/auth/*` except `me`/`logout`, `/api/health`, `/api/categories`, `/api/institutions`), then requires a `Bearer` JWT for everything else. It sets `event.context.auth: JwtPayload` and enforces role prefixes (`/api/admin` → `admin`; `/api/officer` → `schedule_officer|admin`; `/api/legal` → `legal_unit|admin`). Server route handlers should read `event.context.auth` rather than re-verifying tokens.

2. **Client**: `app/middleware/auth.ts` is a Nuxt route middleware that uses the Pinia `auth` store to gate `/admin`, `/officer`, `/legal` page trees and redirect authenticated users away from `/auth/*`.

Token shape (`JwtPayload`): `{ userId, email, roles: string[] }`. Tokens are signed with `jwtSecret`/`jwtRefreshSecret` from `runtimeConfig` (see `nuxt.config.ts`). Helpers live in `app/server/utils/jwt.ts` — use `generateTokenPair`, `getAuthUser`, etc.; do not call `jsonwebtoken` directly elsewhere.

Roles in the system are exactly: `applicant`, `schedule_officer`, `legal_unit`, `admin`. Add new role checks by extending both middleware files together.

### Prisma client is a singleton

Always import via `import prisma from "~/server/utils/prisma"`. Constructing `new PrismaClient()` elsewhere will leak connections in dev (HMR re-imports). The singleton attaches itself to `globalThis` outside production for that reason.

The schema in `app/prisma/schema.prisma` uses `@map`/`@@map` to translate camelCase Prisma fields to snake_case Postgres columns — keep that convention when adding fields.

### Cross-cutting server concerns

State-changing endpoints follow a consistent pattern: validate auth → mutate via Prisma → write an audit log → trigger a notification. Use the shared utilities rather than reimplementing:

- `app/server/utils/audit.ts` — `createAuditLog(event, { userId, action, entityType, entityId, oldValues?, newValues? })` plus an `AuditActions` enum. Call it on every state transition; `audit_logs` is a compliance requirement, not a debug aid.
- `app/server/utils/code-generator.ts` — `generateUniqueCode()` for declaration codes (with collision retry at the call site).
- `app/server/services/notification.service.ts` — high-level helpers like `notifyUniqueCodeGenerated`. The service fans out to `email.service.ts` / `sms.service.ts` based on `NotificationPreference` and writes `NotificationDeliveryLog` rows. Don't call `email.service` or `sms.service` directly from route handlers.
- `app/server/services/storage.service.ts` — MinIO uploads (Ghana Card images, receipt PDFs).
- `app/server/services/pdf.service.ts` — receipt generation via `pdf-lib`.

### Frontend

- Pages are organized by role: `pages/applicant/`, `pages/officer/`, `pages/legal/`, `pages/admin/`. Auth pages under `pages/auth/`. Public pages (`index`, `contact`, `privacy`, `terms`) at the top level.
- Layouts: `default.vue` (public), `auth.vue` (login/register), `dashboard.vue` (post-login app shell).
- State: Pinia stores in `app/stores/` — `auth.ts` persists the token pair to `localStorage` under `adla_tokens` and exposes `isApplicant`/`isOfficer`/`isLegalUnit`/`isAdmin` computed flags used by both the client middleware and dashboard redirects.
- UI: shadcn-vue is configured (`shadcn-nuxt` module, `componentDir: ./components/ui`, `prefix: ""`). The directory is empty until you add components with `npx shadcn-vue@latest add <component>`.
- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`); main stylesheet is `app/assets/css/main.css`.
- TypeScript is strict (`typescript.strict: true` in `nuxt.config.ts`) and `future.compatibilityVersion: 4` is on — code should target Nuxt 4 idioms.

## Configuration

Secrets and infra come from env vars consumed in `nuxt.config.ts` `runtimeConfig`. `app/.env.example` lists every variable; `app/.env` is the local override. Server-only values (JWT secrets, DB URL, MinIO/SMTP creds) are at the top level of `runtimeConfig`; client-exposed values go under `runtimeConfig.public`. Never read these via `process.env` in handlers — use `useRuntimeConfig()`.
