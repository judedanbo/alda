# Dev User Switcher — Design Spec

## Overview

A development-only feature that lets developers and demo presenters quickly switch between different user roles (applicant, schedule_officer, legal_unit, admin) without logging in and out. It performs real login flows against seeded test users, producing authentic sessions with role-appropriate data.

Available only when `NODE_ENV !== 'production'`. Returns 404 in production so the endpoints are invisible.

## Components

### 1. Server — Dev API Endpoints

#### `POST /api/dev/switch-user`

- **Input:** `{ email: string }`
- **Guard:** Returns 404 if `NODE_ENV === 'production'`
- **Behavior:**
  - Looks up the user by email via Prisma, including roles
  - Generates a real token pair using `generateTokenPair()` from `server/utils/jwt.ts`
  - Stores the refresh token in the DB (same as normal login)
  - Returns `{ user, tokens }` matching the login endpoint response shape
- **Errors:** 404 if user not found, 404 in production

#### `GET /api/dev/users`

- **Guard:** Returns 404 if `NODE_ENV === 'production'`
- **Behavior:** Returns seeded dev users (emails ending in `@adla.gov.gh`) with `id`, `email`, and `roles[]`
- **Purpose:** Client component fetches this on mount so it doesn't hardcode user info

### 2. Seed Data — Applicant Test User

Add to `app/prisma/seed.ts`:

- `applicant@adla.gov.gh` (password: `password123`) with the `applicant` role
- `emailVerified: true`, notification preferences enabled
- Completed profile (name, Ghana Card number, etc.) so the applicant dashboard works during demos
- Protected by the existing `if (NODE_ENV === 'production') return` guard in seed.ts

### 3. Client — `<DevUserSwitcher>` Component

**File:** `app/components/DevUserSwitcher.vue`

**Visibility:** Only renders when `runtimeConfig.public.devMode` is `true`.

**Position:** Fixed bottom-center of viewport, high z-index, above all content.

**Layout:**

- "DEV" label with colored dot for current role
- Current user's email and role displayed
- Row of buttons — one per dev user (Applicant, Officer, Legal, Admin), each with a distinct color
- Active user's button is highlighted
- Collapse/expand toggle (chevron) to minimize to just the "DEV" pill

**Behavior:**

- On mount: fetches `GET /api/dev/users` to populate the user list
- On role button click:
  1. Calls `POST /api/dev/switch-user` with the selected user's email
  2. Updates the auth store with returned tokens and user data
  3. Navigates to the appropriate dashboard for the role
- Shows loading state on the clicked button during switch

**Styling:** Semi-transparent dark background, small text, dev-tool aesthetic. Should not be mistaken for part of the real app.

**Placement:** In `app/app.vue`, wrapped in `<ClientOnly>` and gated by `v-if="runtimeConfig.public.devMode"`. Appears on every page regardless of layout.

### 4. Configuration Changes

#### `app/nuxt.config.ts`

Add to `runtimeConfig.public`:

```typescript
devMode: process.env.NODE_ENV !== "production"
```

#### `app/server/middleware/auth.ts`

Conditionally add `/api/dev` to public routes allowlist:

```typescript
if (process.env.NODE_ENV !== "production") {
  publicRoutes.push("/api/dev");
}
```

## Security

- All dev endpoints return 404 in production (not 403) — the routes are invisible
- Server middleware allowlists `/api/dev` only in non-production environments
- Client component only renders when `devMode` is true
- No credentials are hardcoded in client code — the server handles authentication
- Seeded test users are only created when `NODE_ENV !== 'production'`

## Files to Create

- `app/server/api/dev/switch-user.post.ts`
- `app/server/api/dev/users.get.ts`
- `app/components/DevUserSwitcher.vue`

## Files to Modify

- `app/prisma/seed.ts` — add applicant test user
- `app/nuxt.config.ts` — add `devMode` to `runtimeConfig.public`
- `app/server/middleware/auth.ts` — conditionally allowlist `/api/dev`
- `app/app.vue` — mount `<DevUserSwitcher>`
