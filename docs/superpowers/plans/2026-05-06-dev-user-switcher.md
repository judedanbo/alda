# Dev User Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a development-only floating UI bar that switches between seeded test users (applicant, officer, legal, admin) by performing real logins against a dev-only API endpoint.

**Architecture:** Two new server endpoints (`GET /api/dev/users`, `POST /api/dev/switch-user`) gated by `NODE_ENV !== 'production'` provide the switching logic. A `<DevUserSwitcher>` component fetches the user list and triggers switches. The auth middleware allowlists `/api/dev` in non-production environments.

**Tech Stack:** Nuxt 4, Nitro server routes, Prisma, JWT, Pinia, Tailwind v4, Vue 3 Composition API

---

### Task 1: Add `devMode` to runtime config

**Files:**
- Modify: `app/nuxt.config.ts:64-67` (runtimeConfig.public section)

- [ ] **Step 1: Add devMode to public runtimeConfig**

In `app/nuxt.config.ts`, add `devMode` to the `public` block:

```typescript
public: {
  appName: "Asset Declaration Portal",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  devMode: process.env.NODE_ENV !== "production",
},
```

- [ ] **Step 2: Verify the dev server starts cleanly**

Run: `cd app && npm run dev` (verify no startup errors, then stop)

- [ ] **Step 3: Commit**

```bash
git add app/nuxt.config.ts
git commit -m "feat: expose devMode flag in public runtime config"
```

---

### Task 2: Allowlist `/api/dev` in server auth middleware (non-production only)

**Files:**
- Modify: `app/server/middleware/auth.ts:10-21` (publicRoutes array)

- [ ] **Step 1: Add conditional dev route allowlisting**

In `app/server/middleware/auth.ts`, change the `publicRoutes` declaration to conditionally include `/api/dev`:

```typescript
const publicRoutes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/health",
  "/api/categories",
  "/api/institutions",
  ...(process.env.NODE_ENV !== "production" ? ["/api/dev"] : []),
];
```

- [ ] **Step 2: Verify dev server starts and existing auth still works**

Run: `cd app && npm run dev`
Verify: Hit `GET http://localhost:3000/api/health` — should return 200. Hit `GET http://localhost:3000/api/auth/me` without a token — should return 401.

- [ ] **Step 3: Commit**

```bash
git add app/server/middleware/auth.ts
git commit -m "feat: allowlist /api/dev routes in non-production auth middleware"
```

---

### Task 3: Create `GET /api/dev/users` endpoint

**Files:**
- Create: `app/server/api/dev/users.get.ts`

- [ ] **Step 1: Create the endpoint file**

Create `app/server/api/dev/users.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@adla.gov.gh" },
    },
    select: {
      id: true,
      email: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  return {
    success: true,
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: u.roles.map((r) => r.role.name),
    })),
  };
});
```

- [ ] **Step 2: Verify the endpoint works**

Run: `cd app && npm run dev`
Test: `curl http://localhost:3000/api/dev/users`
Expected: JSON with `success: true` and `data` array containing seeded users (admin, officer, officer2, legal, legal2).

- [ ] **Step 3: Commit**

```bash
git add app/server/api/dev/users.get.ts
git commit -m "feat: add GET /api/dev/users endpoint for dev switcher"
```

---

### Task 4: Create `POST /api/dev/switch-user` endpoint

**Files:**
- Create: `app/server/api/dev/switch-user.post.ts`

- [ ] **Step 1: Create the endpoint file**

Create `app/server/api/dev/switch-user.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const body = await readBody(event);
  const email = body?.email;

  if (!email || typeof email !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Email is required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "User not found",
    });
  }

  const roles = user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({ userId: user.id, email: user.email, roles });

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const hasProfile = await prisma.applicantProfile.findUnique({
    where: { userId: user.id },
  });

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        roles,
        hasProfile: !!hasProfile,
      },
      tokens,
    },
  };
});
```

- [ ] **Step 2: Verify the endpoint works**

Run: `cd app && npm run dev`
Test: `curl -X POST http://localhost:3000/api/dev/switch-user -H "Content-Type: application/json" -d '{"email":"admin@adla.gov.gh"}'`
Expected: JSON with `success: true`, `data.user` object with roles `["admin"]`, and `data.tokens` with `accessToken`/`refreshToken` strings.

- [ ] **Step 3: Commit**

```bash
git add app/server/api/dev/switch-user.post.ts
git commit -m "feat: add POST /api/dev/switch-user endpoint for dev switcher"
```

---

### Task 5: Add applicant seed user with profile

**Files:**
- Modify: `app/prisma/seed.ts:206-278` (test user section)

- [ ] **Step 1: Add applicant role lookup and seed user entry**

In `app/prisma/seed.ts`, modify the role lookups (around line 206) to also fetch the applicant role:

```typescript
const [adminRole, officerRole, legalRole, applicantRole] = await Promise.all([
  prisma.role.findUnique({ where: { name: "admin" } }),
  prisma.role.findUnique({ where: { name: "schedule_officer" } }),
  prisma.role.findUnique({ where: { name: "legal_unit" } }),
  prisma.role.findUnique({ where: { name: "applicant" } }),
]);
```

Add the applicant user to the `seedUsers` array (before the existing entries or after — order doesn't matter):

```typescript
{
  email: "applicant@adla.gov.gh",
  phone: "+233200000005",
  role: applicantRole,
  label: "applicant",
},
```

- [ ] **Step 2: Add applicant profile creation after user seeding loop**

After the user seeding `for` loop completes (after line ~276), add:

```typescript
const applicantUser = await prisma.user.findUnique({
  where: { email: "applicant@adla.gov.gh" },
});

if (applicantUser) {
  const firstInstitution = await prisma.institution.findFirst();
  const firstCategory = await prisma.publicOfficeCategory.findFirst();

  if (firstInstitution && firstCategory) {
    await prisma.applicantProfile.upsert({
      where: { userId: applicantUser.id },
      update: {},
      create: {
        userId: applicantUser.id,
        fullName: "Kwame Asante",
        ghanaCardNumber: "GHA-000000001-0",
        ghanaCardFrontUrl: "https://placeholder.local/ghana-card-front.jpg",
        designation: "Director of Finance",
        institutionId: firstInstitution.id,
        officeCategoryId: firstCategory.id,
      },
    });
    console.log("✅ Created applicant profile for applicant@adla.gov.gh");
  }
}
```

- [ ] **Step 3: Run the seed to verify**

Run: `cd app && npm run db:seed`
Expected: Output includes "Created applicant user: applicant@adla.gov.gh" and "Created applicant profile for applicant@adla.gov.gh" with no errors.

- [ ] **Step 4: Verify the new user shows in the dev endpoint**

Run: `curl http://localhost:3000/api/dev/users`
Expected: `data` array now includes `{"email":"applicant@adla.gov.gh","roles":["applicant"]}`.

- [ ] **Step 5: Commit**

```bash
git add app/prisma/seed.ts
git commit -m "feat: add applicant seed user with profile for dev switcher"
```

---

### Task 6: Create `<DevUserSwitcher>` component

**Files:**
- Create: `app/components/DevUserSwitcher.vue`

- [ ] **Step 1: Create the component**

Create `app/components/DevUserSwitcher.vue`:

```vue
<script setup lang="ts">
const authStore = useAuthStore();
const config = useRuntimeConfig();
const router = useRouter();

interface DevUser {
  id: string;
  email: string;
  roles: string[];
}

const users = ref<DevUser[]>([]);
const switching = ref<string | null>(null);
const collapsed = ref(false);

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  schedule_officer: "bg-blue-500",
  legal_unit: "bg-purple-500",
  applicant: "bg-green-500",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  schedule_officer: "Officer",
  legal_unit: "Legal",
  applicant: "Applicant",
};

const roleDashboards: Record<string, string> = {
  admin: "/admin/dashboard",
  schedule_officer: "/officer/dashboard",
  legal_unit: "/legal/dashboard",
  applicant: "/applicant/dashboard",
};

const currentRole = computed(() => {
  if (!authStore.user) return null;
  return authStore.user.roles[0] ?? null;
});

const currentEmail = computed(() => authStore.user?.email ?? "Not logged in");

async function fetchDevUsers() {
  try {
    const res = await $fetch<{ success: boolean; data: DevUser[] }>("/api/dev/users");
    if (res.success) {
      users.value = res.data;
    }
  } catch {
    // silently fail — dev endpoint might not be available
  }
}

async function switchToUser(user: DevUser) {
  switching.value = user.email;
  try {
    const res = await $fetch<{
      success: boolean;
      data: { user: any; tokens: { accessToken: string; refreshToken: string } };
    }>("/api/dev/switch-user", {
      method: "POST",
      body: { email: user.email },
    });

    if (res.success) {
      authStore.user = res.data.user;
      authStore.setTokens(res.data.tokens);
      const primaryRole = res.data.user.roles[0];
      const dashboard = roleDashboards[primaryRole] || "/";
      await router.push(dashboard);
    }
  } catch (e) {
    console.error("[DevSwitcher] Failed to switch user:", e);
  } finally {
    switching.value = null;
  }
}

onMounted(() => {
  fetchDevUsers();
});
</script>

<template>
  <div
    v-if="config.public.devMode"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]"
  >
    <!-- Collapsed state -->
    <button
      v-if="collapsed"
      class="flex items-center gap-1.5 rounded-full bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm border border-gray-700 hover:bg-gray-800/90 transition-colors"
      @click="collapsed = false"
    >
      <span class="inline-block h-2 w-2 rounded-full" :class="currentRole ? roleColors[currentRole] : 'bg-gray-500'" />
      <span class="font-mono">DEV</span>
      <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clip-rule="evenodd" /></svg>
    </button>

    <!-- Expanded state -->
    <div
      v-else
      class="flex items-center gap-3 rounded-full bg-gray-900/90 px-4 py-2 text-xs text-white shadow-lg backdrop-blur-sm border border-gray-700"
    >
      <div class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full" :class="currentRole ? roleColors[currentRole] : 'bg-gray-500'" />
        <span class="font-mono font-semibold">DEV</span>
        <span class="text-gray-400 max-w-[140px] truncate">{{ currentEmail }}</span>
      </div>

      <div class="h-4 w-px bg-gray-600" />

      <div class="flex items-center gap-1.5">
        <button
          v-for="devUser in users"
          :key="devUser.id"
          :disabled="switching !== null"
          class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-50"
          :class="[
            devUser.email === authStore.user?.email
              ? `${roleColors[devUser.roles[0]]} text-white`
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
          ]"
          @click="switchToUser(devUser)"
        >
          <span v-if="switching === devUser.email" class="inline-block animate-spin">&#8635;</span>
          <span v-else>{{ roleLabels[devUser.roles[0]] || devUser.roles[0] }}</span>
        </button>
      </div>

      <button
        class="ml-1 text-gray-400 hover:text-white transition-colors"
        @click="collapsed = true"
      >
        <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/DevUserSwitcher.vue
git commit -m "feat: add DevUserSwitcher floating component"
```

---

### Task 7: Mount the switcher in `app.vue`

**Files:**
- Modify: `app/app.vue`

- [ ] **Step 1: Add the component to app.vue**

Replace the contents of `app/app.vue` with:

```vue
<script setup lang="ts">
const config = useRuntimeConfig();

useHead({
  title: "Asset Declaration Portal",
  meta: [
    { name: "description", content: "Ghana Asset Declaration System under Article 286(5)" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
  ],
  htmlAttrs: {
    lang: "en",
  },
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <DevUserSwitcher v-if="config.public.devMode" />
  </ClientOnly>
</template>
```

- [ ] **Step 2: Verify in browser**

Run: `cd app && npm run dev`
Open: `http://localhost:3000`
Expected: A dark floating pill at the bottom-center of the page showing "DEV" with role buttons. Clicking a button should switch the session and redirect to the appropriate dashboard.

- [ ] **Step 3: Commit**

```bash
git add app/app.vue
git commit -m "feat: mount DevUserSwitcher in app.vue for non-production"
```

---

### Task 8: Smoke test the full flow

- [ ] **Step 1: Start from a clean state**

Run: `cd app && npm run db:push && npm run db:seed && npm run dev`

- [ ] **Step 2: Test each role switch**

1. Open `http://localhost:3000`
2. Click "Admin" button — should redirect to `/admin/dashboard`
3. Click "Officer" button — should redirect to `/officer/dashboard`
4. Click "Legal" button — should redirect to `/legal/dashboard`
5. Click "Applicant" button — should redirect to `/applicant/dashboard`
6. Verify the collapse/expand toggle works
7. Verify the current user email updates after each switch
8. Verify the active button is highlighted with its role color

- [ ] **Step 3: Verify production safety**

Temporarily set `NODE_ENV=production` and verify:
- The switcher component does not render
- `GET /api/dev/users` returns 404
- `POST /api/dev/switch-user` returns 404

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during dev switcher smoke test"
```
