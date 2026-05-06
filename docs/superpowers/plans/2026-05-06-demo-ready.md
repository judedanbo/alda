# ADLA Demo-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Asset Declaration app to a testable, demo-ready state by fixing broken auth/email flows, establishing a shadcn-vue component system, refactoring all pages, and adding missing pages.

**Architecture:** Phase A fixes broken backend flows (email sending, email verification, password reset). Phase B creates the component foundation (shadcn-vue + composables + shared components). Phase C refactors all 27 pages onto the component system. Phase D adds missing pages (settings, admin categories, profile edit).

**Tech Stack:** Nuxt 4, Vue 3, Prisma (PostgreSQL), shadcn-vue, Tailwind v4, Pinia, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-06-demo-ready-design.md`

**Key discovery:** The notification service is already wired into all 5 state-transition endpoints (declarations, submissions, reviews, receipts, pickups). Phase A4 from the spec is already done — this plan includes a verification step instead.

---

## Task 1: Add EmailVerificationToken to Prisma Schema

**Files:**
- Modify: `app/prisma/schema.prisma`

- [ ] **Step 1: Add EmailVerificationToken model to schema**

Add after the `PasswordResetToken` model (around line 90):

```prisma
model EmailVerificationToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  token     String    @unique @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("email_verification_tokens")
}
```

- [ ] **Step 2: Add the relation to the User model**

In the User model's relations section, add:

```prisma
  emailVerificationTokens EmailVerificationToken[]
```

- [ ] **Step 3: Generate Prisma client and create migration**

Run from `app/`:

```bash
npx prisma migrate dev --name add_email_verification_tokens
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add app/prisma/schema.prisma app/prisma/migrations/
git commit -m "Add EmailVerificationToken model to Prisma schema"
```

---

## Task 2: Add sendVerificationEmail to Email Service

**Files:**
- Modify: `app/server/services/email.service.ts`

The email template `"email-verification"` already exists and expects `{ name, verificationUrl }`. Only the convenience wrapper function is missing.

- [ ] **Step 1: Add sendVerificationEmail function**

Add at the end of `app/server/services/email.service.ts`, after `sendDeclarationStatusEmail`:

```typescript
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: "Verify Your Email Address",
    template: "email-verification",
    data: {
      name,
      verificationUrl: `${config.public.appUrl}/auth/verify-email?token=${token}`,
    },
  });
}

export async function sendContactAcknowledgment(
  to: string,
  name: string,
  category: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "We Received Your Inquiry",
    template: "welcome",
    data: {
      name,
      loginUrl: "",
    },
  });
}
```

Note: `sendContactAcknowledgment` reuses the welcome template as a simple acknowledgment. A dedicated contact-acknowledgment template can be added later.

- [ ] **Step 2: Commit**

```bash
git add app/server/services/email.service.ts
git commit -m "Add sendVerificationEmail and sendContactAcknowledgment to email service"
```

---

## Task 3: Wire Email Sending into Auth Endpoints

**Files:**
- Modify: `app/server/api/auth/register.post.ts`
- Modify: `app/server/api/auth/forgot-password.post.ts`
- Modify: `app/server/api/contact.post.ts`

- [ ] **Step 1: Wire emails into register endpoint**

In `app/server/api/auth/register.post.ts`, add the import at the top:

```typescript
import { sendWelcomeEmail, sendVerificationEmail } from "~/server/services/email.service";
import { generateVerificationToken } from "~/server/utils/code-generator";
```

After the user creation and audit log (where the TODO comment is), replace the TODO with:

```typescript
  // Create email verification token
  const verificationToken = generateVerificationToken();
  const verificationExpiry = new Date();
  verificationExpiry.setHours(verificationExpiry.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: verificationToken,
      expiresAt: verificationExpiry,
    },
  });

  // Send emails (non-blocking)
  try {
    await sendWelcomeEmail(user.email, user.email);
    await sendVerificationEmail(user.email, user.email, verificationToken);
  } catch (e) {
    console.error("Failed to send registration emails:", e);
  }
```

- [ ] **Step 2: Wire email into forgot-password endpoint**

In `app/server/api/auth/forgot-password.post.ts`, add the import:

```typescript
import { sendPasswordResetEmail } from "~/server/services/email.service";
```

After the token creation (where the TODO comment is), replace the TODO with:

```typescript
  try {
    await sendPasswordResetEmail(user.email, user.email, token);
  } catch (e) {
    console.error("Failed to send password reset email:", e);
  }
```

- [ ] **Step 3: Wire email into contact endpoint**

In `app/server/api/contact.post.ts`, add the import:

```typescript
import { sendContactAcknowledgment } from "~/server/services/email.service";
```

After the `prisma.contactSubmission.create()` call (where the TODO comments are), replace the TODOs with:

```typescript
  try {
    await sendContactAcknowledgment(data.email, data.name, data.category);
  } catch (e) {
    console.error("Failed to send contact acknowledgment:", e);
  }
```

- [ ] **Step 4: Commit**

```bash
git add app/server/api/auth/register.post.ts app/server/api/auth/forgot-password.post.ts app/server/api/contact.post.ts
git commit -m "Wire email sending into register, forgot-password, and contact endpoints"
```

---

## Task 4: Create Email Verification API Endpoints

**Files:**
- Create: `app/server/api/auth/verify-email.get.ts`
- Create: `app/server/api/auth/resend-verification.post.ts`
- Modify: `app/server/api/auth/login.post.ts` (add emailVerified to response — verify it's already there)

- [ ] **Step 1: Create verify-email endpoint**

Create `app/server/api/auth/verify-email.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = query.token as string;

  if (!token) {
    throw createError({
      statusCode: 400,
      message: "Verification token is required",
    });
  }

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    throw createError({
      statusCode: 400,
      message: "Invalid verification token",
    });
  }

  if (verificationToken.usedAt) {
    throw createError({
      statusCode: 400,
      message: "This verification link has already been used",
    });
  }

  if (verificationToken.expiresAt < new Date()) {
    throw createError({
      statusCode: 400,
      message: "This verification link has expired. Please request a new one.",
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await createAuditLog(event, {
    userId: verificationToken.userId,
    action: AuditActions.USER_LOGIN,
    entityType: "user",
    entityId: verificationToken.userId,
    newValues: { emailVerified: true },
  });

  return {
    success: true,
    message: "Email verified successfully. You can now log in.",
  };
});
```

- [ ] **Step 2: Create resend-verification endpoint**

Create `app/server/api/auth/resend-verification.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { generateVerificationToken } from "~/server/utils/code-generator";
import { sendVerificationEmail } from "~/server/services/email.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  });

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  if (user.emailVerified) {
    return { success: true, message: "Email is already verified" };
  }

  // Rate limit: check if a token was created in the last 2 minutes
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
  });

  if (recentToken) {
    throw createError({
      statusCode: 429,
      message: "Please wait 2 minutes before requesting another verification email",
    });
  }

  // Invalidate old tokens
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id },
  });

  // Create new token
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  try {
    await sendVerificationEmail(user.email, user.email, token);
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }

  return {
    success: true,
    message: "Verification email sent. Please check your inbox.",
  };
});
```

- [ ] **Step 3: Add verify-email and resend-verification to public routes in server middleware**

In `app/server/middleware/auth.ts`, the `publicRoutes` array already includes `"/api/auth/verify-email"`. Verify this is the case. If not, add it. Also add resend-verification as a protected route (it requires auth, so no change needed — it's not in the public list).

- [ ] **Step 4: Verify login endpoint already returns emailVerified**

Read `app/server/api/auth/login.post.ts` and confirm the response includes `emailVerified` in the user object. The login endpoint already includes it based on the User model query with `include: { roles: { include: { role: true } } }`. Confirm the response mapping includes `emailVerified: user.emailVerified`.

- [ ] **Step 5: Commit**

```bash
git add app/server/api/auth/verify-email.get.ts app/server/api/auth/resend-verification.post.ts
git commit -m "Add email verification and resend-verification endpoints"
```

---

## Task 5: Create Password Reset and Email Verification Pages

**Files:**
- Create: `app/pages/auth/reset-password.vue`
- Create: `app/pages/auth/verify-email.vue`
- Modify: `app/pages/auth/forgot-password.vue` (update success message)
- Modify: `app/middleware/auth.ts` (add verify-email to public routes)

- [ ] **Step 1: Create reset-password page**

Create `app/pages/auth/reset-password.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = route.query.token as string;

const password = ref("");
const confirmPassword = ref("");
const isLoading = ref(false);
const error = ref("");
const success = ref(false);

const passwordValid = computed(() => {
  const p = password.value;
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
});

const passwordsMatch = computed(() => password.value === confirmPassword.value);

async function handleSubmit() {
  error.value = "";

  if (!token) {
    error.value = "Invalid reset link. Please request a new password reset.";
    return;
  }

  if (!passwordValid.value) {
    error.value = "Password must be at least 8 characters with uppercase, lowercase, and a number.";
    return;
  }

  if (!passwordsMatch.value) {
    error.value = "Passwords do not match.";
    return;
  }

  isLoading.value = true;
  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: password.value },
    });
    success.value = true;
  } catch (e: any) {
    error.value = e.data?.message || "Failed to reset password. The link may have expired.";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="bg-card rounded-lg shadow-lg p-8">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-foreground">Reset Password</h1>
        <p class="text-muted-foreground mt-1">Enter your new password</p>
      </div>

      <!-- Success State -->
      <div v-if="success" class="text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-2">Password Reset Successfully</h2>
        <p class="text-muted-foreground mb-4">You can now log in with your new password.</p>
        <NuxtLink to="/auth/login" class="text-primary hover:underline font-medium">
          Go to Login
        </NuxtLink>
      </div>

      <!-- No Token State -->
      <div v-else-if="!token" class="text-center">
        <div class="bg-destructive/10 text-destructive rounded-lg p-4 mb-4">
          Invalid reset link. Please request a new password reset.
        </div>
        <NuxtLink to="/auth/forgot-password" class="text-primary hover:underline font-medium">
          Request Password Reset
        </NuxtLink>
      </div>

      <!-- Form State -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {{ error }}
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-foreground mb-1">New Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter new password"
          />
          <div class="mt-1 space-y-1 text-xs">
            <p :class="password.length >= 8 ? 'text-green-600' : 'text-muted-foreground'">At least 8 characters</p>
            <p :class="/[A-Z]/.test(password) ? 'text-green-600' : 'text-muted-foreground'">One uppercase letter</p>
            <p :class="/[a-z]/.test(password) ? 'text-green-600' : 'text-muted-foreground'">One lowercase letter</p>
            <p :class="/\d/.test(password) ? 'text-green-600' : 'text-muted-foreground'">One number</p>
          </div>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Confirm new password"
          />
          <p v-if="confirmPassword && !passwordsMatch" class="mt-1 text-xs text-destructive">
            Passwords do not match
          </p>
        </div>

        <button
          type="submit"
          :disabled="isLoading || !passwordValid || !passwordsMatch"
          class="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? "Resetting..." : "Reset Password" }}
        </button>

        <p class="text-center text-sm text-muted-foreground">
          <NuxtLink to="/auth/login" class="text-primary hover:underline">Back to Login</NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create verify-email page**

Create `app/pages/auth/verify-email.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const route = useRoute();
const token = route.query.token as string;

const isLoading = ref(true);
const success = ref(false);
const error = ref("");

onMounted(async () => {
  if (!token) {
    error.value = "No verification token provided.";
    isLoading.value = false;
    return;
  }

  try {
    await $fetch("/api/auth/verify-email", {
      params: { token },
    });
    success.value = true;
  } catch (e: any) {
    error.value = e.data?.message || "Failed to verify email. The link may have expired.";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="bg-card rounded-lg shadow-lg p-8 text-center">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-foreground">Email Verification</h1>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-muted-foreground">Verifying your email...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="success">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-2">Email Verified!</h2>
        <p class="text-muted-foreground mb-4">Your email has been verified successfully.</p>
        <NuxtLink to="/auth/login" class="inline-block py-2 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          Go to Login
        </NuxtLink>
      </div>

      <!-- Error State -->
      <div v-else>
        <div class="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-2">Verification Failed</h2>
        <p class="text-muted-foreground mb-4">{{ error }}</p>
        <NuxtLink to="/auth/login" class="text-primary hover:underline font-medium">
          Go to Login
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Update forgot-password success message**

In `app/pages/auth/forgot-password.vue`, find the success state text and update it to mention checking email. Look for the success message paragraph and change it to:

```
"If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder."
```

- [ ] **Step 4: Add verify-email to client middleware public routes**

In `app/middleware/auth.ts`, add `"/auth/verify-email"` to the `publicRoutes` array:

```typescript
const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];
```

- [ ] **Step 5: Commit**

```bash
git add app/pages/auth/reset-password.vue app/pages/auth/verify-email.vue app/pages/auth/forgot-password.vue app/middleware/auth.ts
git commit -m "Add password reset and email verification pages"
```

---

## Task 6: Add Email Verification Banner to Applicant Dashboard

**Files:**
- Modify: `app/stores/auth.ts`
- Modify: `app/pages/applicant/dashboard.vue`

- [ ] **Step 1: Add isEmailVerified computed to auth store**

In `app/stores/auth.ts`, add this computed after the existing role computed properties:

```typescript
const isEmailVerified = computed(() => user.value?.emailVerified ?? false);
```

And add `isEmailVerified` to the store's return statement.

- [ ] **Step 2: Add verification banner to applicant dashboard**

In `app/pages/applicant/dashboard.vue`, add a banner after the opening of the main content area (after `definePageMeta` setup, at the top of the template's main container):

```html
    <!-- Email Verification Banner -->
    <div v-if="authStore.user && !authStore.isEmailVerified" class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p class="font-medium text-amber-800">Please verify your email</p>
          <p class="text-sm text-amber-600">Check your inbox for the verification link, or request a new one.</p>
        </div>
      </div>
      <button
        @click="resendVerification"
        :disabled="resendLoading"
        class="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
      >
        {{ resendLoading ? "Sending..." : "Resend" }}
      </button>
    </div>
```

Add the resend logic in the `<script setup>`:

```typescript
const resendLoading = ref(false);

async function resendVerification() {
  resendLoading.value = true;
  try {
    await $fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: authStore.getAuthHeaders(),
    });
    alert("Verification email sent! Check your inbox.");
  } catch (e: any) {
    alert(e.data?.message || "Failed to send verification email.");
  } finally {
    resendLoading.value = false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/stores/auth.ts app/pages/applicant/dashboard.vue
git commit -m "Add email verification banner to applicant dashboard"
```

---

## Task 7: Verify Notification Wiring (Audit Step)

**Files:**
- Read-only audit of: `app/server/api/declarations/index.post.ts`, `app/server/api/submissions/index.post.ts`, `app/server/api/reviews/index.post.ts`, `app/server/api/receipts/[declarationId].post.ts`, `app/server/api/pickup/[declarationId].post.ts`

- [ ] **Step 1: Verify all 5 endpoints already call notification service**

Read each file and confirm:
1. `declarations/index.post.ts` — calls `notifyUniqueCodeGenerated` ✓
2. `submissions/index.post.ts` — calls `sendNotification` ✓
3. `reviews/index.post.ts` — calls `sendNotification` for both approve/reject paths ✓
4. `receipts/[declarationId].post.ts` — calls `sendNotification` ✓
5. `pickup/[declarationId].post.ts` — calls `sendNotification` ✓

If any are missing, wire them following the pattern:

```typescript
try {
  await sendNotification({ ... });
} catch (e) {
  console.error("Notification failed:", e);
}
```

No commit needed if all are confirmed present.

---

## Task 8: Install shadcn-vue Components

**Files:**
- Create: `app/components/ui/` (multiple component directories)

- [ ] **Step 1: Install shadcn-vue components**

Run from `app/`:

```bash
npx shadcn-vue@latest add button input label card table dialog badge select textarea dropdown-menu alert separator tabs pagination tooltip switch skeleton
```

If prompted for configuration, accept defaults. This will create component files under `app/components/ui/`.

- [ ] **Step 2: Verify components were created**

```bash
ls app/components/ui/
```

Expected: Directories for each component (button, input, label, card, table, dialog, badge, select, textarea, dropdown-menu, alert, separator, tabs, pagination, tooltip, switch, skeleton).

- [ ] **Step 3: Commit**

```bash
git add app/components/
git commit -m "Install shadcn-vue components"
```

---

## Task 9: Create useApiFetch Composable

**Files:**
- Create: `app/composables/useApiFetch.ts`

- [ ] **Step 1: Create the composable**

Create `app/composables/useApiFetch.ts`:

```typescript
import { useAuthStore } from "~/stores/auth";

interface ApiFetchOptions<T> extends Omit<Parameters<typeof $fetch>[1], "body"> {
  body?: Record<string, unknown> | FormData;
  immediate?: boolean;
}

interface ApiError {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string[]>;
}

export function useApiFetch<T = unknown>(url: string | Ref<string>, options: ApiFetchOptions<T> = {}) {
  const authStore = useAuthStore();
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<ApiError | null>(null);
  const pending = ref(false);

  async function execute() {
    error.value = null;
    pending.value = true;

    const resolvedUrl = unref(url);

    try {
      const result = await $fetch<T>(resolvedUrl, {
        ...options,
        headers: {
          ...authStore.getAuthHeaders(),
          ...(options.headers || {}),
        },
      });
      data.value = result;
      return result;
    } catch (e: any) {
      if (e.status === 401 || e.statusCode === 401) {
        const refreshed = await authStore.refreshTokens();
        if (refreshed) {
          try {
            const result = await $fetch<T>(resolvedUrl, {
              ...options,
              headers: {
                ...authStore.getAuthHeaders(),
                ...(options.headers || {}),
              },
            });
            data.value = result;
            return result;
          } catch (retryError: any) {
            error.value = normalizeError(retryError);
          }
        } else {
          authStore.logout();
          navigateTo("/auth/login");
        }
      } else {
        error.value = normalizeError(e);
      }
    } finally {
      pending.value = false;
    }
    return null;
  }

  function normalizeError(e: any): ApiError {
    return {
      message: e.data?.message || e.message || "An unexpected error occurred",
      statusCode: e.status || e.statusCode || 500,
      fieldErrors: e.data?.data?.fieldErrors,
    };
  }

  if (options.immediate !== false && options.method === undefined) {
    execute();
  }

  return { data, error, pending, execute };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useApiFetch.ts
git commit -m "Create useApiFetch composable with auth headers and 401 retry"
```

---

## Task 10: Create useAuth, useDeclarations, and useNotifications Composables

**Files:**
- Create: `app/composables/useAuth.ts`
- Create: `app/composables/useDeclarations.ts`
- Create: `app/composables/useNotifications.ts`

- [ ] **Step 1: Create useAuth composable**

Create `app/composables/useAuth.ts`:

```typescript
import { useAuthStore } from "~/stores/auth";

export function useAuth() {
  const store = useAuthStore();

  const user = computed(() => store.user);
  const isAuthenticated = computed(() => store.isAuthenticated);
  const isEmailVerified = computed(() => store.isEmailVerified);
  const isApplicant = computed(() => store.isApplicant);
  const isOfficer = computed(() => store.isOfficer);
  const isLegalUnit = computed(() => store.isLegalUnit);
  const isAdmin = computed(() => store.isAdmin);

  return {
    user,
    isAuthenticated,
    isEmailVerified,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    login: store.login,
    logout: store.logout,
    register: store.register,
    getAuthHeaders: store.getAuthHeaders,
  };
}
```

- [ ] **Step 2: Create useDeclarations composable**

Create `app/composables/useDeclarations.ts`:

```typescript
export function useDeclarations() {
  const { getAuthHeaders } = useAuth();

  async function fetchDeclarations(params?: { page?: number; status?: string }) {
    return $fetch<any>("/api/declarations", {
      headers: getAuthHeaders(),
      params,
    });
  }

  async function fetchDeclaration(id: string) {
    return $fetch<any>(`/api/declarations/${id}`, {
      headers: getAuthHeaders(),
    });
  }

  async function createDeclaration() {
    return $fetch<any>("/api/declarations", {
      method: "POST",
      headers: getAuthHeaders(),
    });
  }

  async function submitDeclaration(id: string) {
    return $fetch<any>(`/api/declarations/${id}/submit`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  }

  async function fetchDeclarationStatus(id: string) {
    return $fetch<any>(`/api/declarations/${id}/status`, {
      headers: getAuthHeaders(),
    });
  }

  return {
    fetchDeclarations,
    fetchDeclaration,
    createDeclaration,
    submitDeclaration,
    fetchDeclarationStatus,
  };
}
```

- [ ] **Step 3: Create useNotifications composable**

Create `app/composables/useNotifications.ts`:

```typescript
import { useNotificationsStore } from "~/stores/notifications";

export function useNotifications() {
  const store = useNotificationsStore();

  const notifications = computed(() => store.notifications);
  const unreadCount = computed(() => store.unreadCount);
  const hasUnread = computed(() => store.hasUnread);

  return {
    notifications,
    unreadCount,
    hasUnread,
    fetchNotifications: store.fetchNotifications,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    refreshUnreadCount: store.refreshUnreadCount,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add app/composables/
git commit -m "Create useAuth, useDeclarations, and useNotifications composables"
```

---

## Task 11: Create Shared App Components

**Files:**
- Create: `app/components/app/StatusBadge.vue`
- Create: `app/components/app/ConfirmDialog.vue`
- Create: `app/components/app/NotificationBell.vue`
- Create: `app/components/app/PageHeader.vue`

- [ ] **Step 1: Create StatusBadge component**

Create `app/components/app/StatusBadge.vue`:

```vue
<script setup lang="ts">
import { Badge } from "~/components/ui/badge";

const props = defineProps<{
  status: string;
}>();

const config = computed(() => {
  const map: Record<string, { label: string; variant: string; class: string }> = {
    PENDING: { label: "Pending", variant: "outline", class: "border-amber-300 text-amber-700 bg-amber-50" },
    SUBMITTED: { label: "Submitted", variant: "default", class: "bg-blue-100 text-blue-700" },
    UNDER_REVIEW: { label: "Under Review", variant: "secondary", class: "bg-purple-100 text-purple-700" },
    APPROVED: { label: "Approved", variant: "default", class: "bg-green-100 text-green-700" },
    REJECTED: { label: "Rejected", variant: "destructive", class: "bg-red-100 text-red-700" },
    SEALED: { label: "Sealed", variant: "default", class: "bg-emerald-100 text-emerald-700" },
    COMPLETED: { label: "Completed", variant: "secondary", class: "bg-gray-100 text-gray-700" },
  };
  return map[props.status] || { label: props.status, variant: "outline", class: "" };
});
</script>

<template>
  <Badge :class="config.class">
    {{ config.label }}
  </Badge>
</template>
```

- [ ] **Step 2: Create ConfirmDialog component**

Create `app/components/app/ConfirmDialog.vue`:

```vue
<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => { if (!v) emit('cancel') }">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button
          :variant="destructive ? 'destructive' : 'default'"
          @click="emit('confirm')"
        >
          {{ confirmLabel || "Confirm" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 3: Create NotificationBell component**

Create `app/components/app/NotificationBell.vue`:

```vue
<script setup lang="ts">
const { unreadCount, refreshUnreadCount } = useNotifications();

onMounted(() => {
  refreshUnreadCount();
});
</script>

<template>
  <NuxtLink to="/notifications" class="relative p-2 text-muted-foreground hover:text-foreground">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    <span
      v-if="unreadCount > 0"
      class="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-medium"
    >
      {{ unreadCount > 99 ? "99+" : unreadCount }}
    </span>
  </NuxtLink>
</template>
```

- [ ] **Step 4: Create PageHeader component**

Create `app/components/app/PageHeader.vue`:

```vue
<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
      <p v-if="description" class="text-muted-foreground mt-1">{{ description }}</p>
    </div>
    <div v-if="$slots.actions">
      <slot name="actions" />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Create DataTable component**

Create `app/components/app/DataTable.vue`:

```vue
<script setup lang="ts">
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";

export interface Column {
  key: string;
  label: string;
  class?: string;
}

defineProps<{
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
}>();
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead v-for="col in columns" :key="col.key" :class="col.class">
          {{ col.label }}
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <!-- Loading skeleton -->
      <template v-if="loading">
        <TableRow v-for="i in 5" :key="'skeleton-' + i">
          <TableCell v-for="col in columns" :key="col.key">
            <Skeleton class="h-4 w-full" />
          </TableCell>
        </TableRow>
      </template>

      <!-- Empty state -->
      <TableRow v-else-if="data.length === 0">
        <TableCell :colspan="columns.length" class="text-center py-12 text-muted-foreground">
          {{ emptyMessage || "No data found" }}
        </TableCell>
      </TableRow>

      <!-- Data rows -->
      <template v-else>
        <TableRow v-for="(row, index) in data" :key="index">
          <TableCell v-for="col in columns" :key="col.key" :class="col.class">
            <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </TableCell>
        </TableRow>
      </template>
    </TableBody>
  </Table>
</template>
```

- [ ] **Step 6: Commit**

```bash
git add app/components/app/
git commit -m "Create shared app components: StatusBadge, ConfirmDialog, NotificationBell, PageHeader, DataTable"
```

---

## Task 12: Refactor Dashboard Layout

**Files:**
- Modify: `app/layouts/dashboard.vue`

- [ ] **Step 1: Integrate NotificationBell and DropdownMenu into dashboard layout**

In `app/layouts/dashboard.vue`, replace the existing notification bell link (an inline SVG link to `/notifications`) with:

```vue
<AppNotificationBell />
```

Replace the existing user button/profile section in the header with a proper dropdown using shadcn-vue DropdownMenu:

```vue
<DropdownMenu>
  <DropdownMenuTrigger as-child>
    <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted">
      <div class="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
        {{ authStore.user?.email?.charAt(0).toUpperCase() }}
      </div>
      <span class="hidden md:inline text-sm text-foreground">{{ authStore.user?.email }}</span>
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem as-child>
      <NuxtLink to="/settings/preferences">Settings</NuxtLink>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem @click="handleLogout" class="text-destructive">
      Logout
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Add the imports at the top of the script:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
```

- [ ] **Step 2: Add Settings link to navigation for all roles**

In the navigation items computed, add a "Settings" entry for all roles, or add it outside the role-based nav as a common item visible to everyone.

- [ ] **Step 3: Commit**

```bash
git add app/layouts/dashboard.vue
git commit -m "Integrate NotificationBell and DropdownMenu into dashboard layout"
```

---

## Task 13: Refactor Auth Pages onto shadcn-vue Components

**Files:**
- Modify: `app/pages/auth/login.vue`
- Modify: `app/pages/auth/register.vue`
- Modify: `app/pages/auth/forgot-password.vue`
- Modify: `app/pages/auth/reset-password.vue`
- Modify: `app/pages/auth/verify-email.vue`

- [ ] **Step 1: Establish the refactoring pattern**

For each auth page, apply these replacements:

```
<input class="...">  →  <Input />
<button class="...">  →  <Button />
<label class="...">   →  <Label />
Error div              →  <Alert variant="destructive"><AlertDescription>...</AlertDescription></Alert>
Success div            →  <Alert><AlertDescription>...</AlertDescription></Alert>
```

Add imports at the top of each page:

```typescript
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
```

Wrap form content in `<Card><CardHeader>...<CardContent>...` structure.

- [ ] **Step 2: Refactor login.vue**

Replace the outer `div.bg-card` with `<Card>`, the title section with `<CardHeader><CardTitle>/<CardDescription>`, the form body with `<CardContent>`, all `<input>` with `<Input>`, all `<button>` with `<Button>`, all `<label>` with `<Label>`, and the error alert with `<Alert variant="destructive">`.

- [ ] **Step 3: Refactor register.vue**

Same pattern as login. Replace raw form elements with shadcn components.

- [ ] **Step 4: Refactor forgot-password.vue**

Same pattern. This page has both a form state and success state — replace both.

- [ ] **Step 5: Refactor reset-password.vue and verify-email.vue**

These were just created in Task 5 with raw HTML. Replace with shadcn components following the same pattern. Since these are new, you may choose to refactor them in-place during Task 5 instead.

- [ ] **Step 6: Commit**

```bash
git add app/pages/auth/
git commit -m "Refactor auth pages onto shadcn-vue components"
```

---

## Task 14: Refactor Applicant Pages

**Files:**
- Modify: `app/pages/applicant/dashboard.vue`
- Modify: `app/pages/applicant/declarations.vue`
- Modify: `app/pages/applicant/declaration/new.vue`
- Modify: `app/pages/applicant/declaration/[id].vue`
- Modify: `app/pages/applicant/profile/setup.vue`

- [ ] **Step 1: Refactor applicant/dashboard.vue**

Replace raw HTML with shadcn components:
- Stats cards → `<Card><CardHeader><CardTitle>...`
- Quick action buttons → `<Button>`
- Page title → `<PageHeader title="Dashboard">`
- Profile alert → `<Alert>`
- Use `useAuth()` composable instead of direct store import
- Use `useDeclarations()` composable for fetching declarations

- [ ] **Step 2: Refactor applicant/declarations.vue**

- Status filter → `<Select>` component
- Table → shadcn `<Table>` with `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>`
- Status spans → `<StatusBadge :status="declaration.status">`
- Pagination → shadcn `<Pagination>`
- Page header → `<PageHeader title="My Declarations">`
- Use `useDeclarations()` composable

- [ ] **Step 3: Refactor applicant/declaration/new.vue**

- Buttons → `<Button>`
- Success state card → `<Card>` with `<Alert>`
- Use `useDeclarations()` composable for `createDeclaration()` and `submitDeclaration()`

- [ ] **Step 4: Refactor applicant/declaration/[id].vue**

- Detail card → `<Card>`
- Status → `<StatusBadge>`
- Timeline items → styled with `<Separator>` between entries
- Use `useDeclarations()` composable for `fetchDeclaration()`

- [ ] **Step 5: Refactor applicant/profile/setup.vue**

- Form inputs → `<Input>`, `<Label>`, `<Select>` for dropdowns
- Step indicators → `<Tabs>` or keep custom (3-step wizard is custom enough)
- Buttons → `<Button>`
- File upload area → keep custom but wrap action buttons with `<Button>`

- [ ] **Step 6: Commit**

```bash
git add app/pages/applicant/
git commit -m "Refactor applicant pages onto shadcn-vue components"
```

---

## Task 15: Refactor Officer Pages

**Files:**
- Modify: `app/pages/officer/dashboard.vue`
- Modify: `app/pages/officer/submissions.vue`
- Modify: `app/pages/officer/reviews.vue`
- Modify: `app/pages/officer/receipts.vue`
- Modify: `app/pages/officer/pickups.vue`

- [ ] **Step 1: Refactor officer/dashboard.vue**

- Stats cards → `<Card>`
- Quick actions → `<Button>`
- Page header → `<PageHeader>`

- [ ] **Step 2: Refactor officer/submissions.vue**

- Table → shadcn `<Table>`
- Search input → `<Input>`
- Record submission modal → `<Dialog>` with `<DialogHeader>`, `<DialogContent>`, form using `<Input>`, `<Textarea>`, `<Button>`
- Status spans → `<StatusBadge>`

- [ ] **Step 3: Refactor officer/reviews.vue**

- Table → shadcn `<Table>`
- Review modal → `<Dialog>`
- Approve/Reject buttons → `<Button variant="default">` / `<Button variant="destructive">`
- Add `<ConfirmDialog>` for rejection action
- Rejection reason → `<Textarea>`

- [ ] **Step 4: Refactor officer/receipts.vue and pickups.vue**

Same pattern: tables → `<Table>`, modals → `<Dialog>`, buttons → `<Button>`, status → `<StatusBadge>`.
Add `<ConfirmDialog>` before pickup completion.

- [ ] **Step 5: Commit**

```bash
git add app/pages/officer/
git commit -m "Refactor officer pages onto shadcn-vue components"
```

---

## Task 16: Refactor Legal, Admin, and Public Pages

**Files:**
- Modify: `app/pages/legal/dashboard.vue`, `app/pages/legal/verify.vue`
- Modify: `app/pages/admin/dashboard.vue`, `app/pages/admin/declarations.vue`, `app/pages/admin/users.vue`, `app/pages/admin/institutions.vue`, `app/pages/admin/audit-logs.vue`, `app/pages/admin/reports.vue`
- Modify: `app/pages/index.vue`, `app/pages/contact.vue`, `app/pages/notifications.vue`, `app/pages/privacy.vue`, `app/pages/terms.vue`

- [ ] **Step 1: Refactor legal pages**

- `legal/dashboard.vue` → `<PageHeader>`, `<Card>` for info sections
- `legal/verify.vue` → `<Input>` for code entry, `<Button>`, `<Card>` for result display, `<StatusBadge>`

- [ ] **Step 2: Refactor admin pages**

- `admin/dashboard.vue` → `<Card>` for stats, `<Tabs>` for Recent Users/Declarations/Audit Logs, `<Table>` for lists
- `admin/users.vue` → `<Table>`, `<Input>` for search, `<Select>` for filters, `<Dialog>` for edit modal, `<ConfirmDialog>` for deactivation
- `admin/institutions.vue` → `<Table>`, `<Dialog>` for create/edit, `<ConfirmDialog>` for deactivation
- `admin/declarations.vue` → `<Table>`, `<StatusBadge>`, `<Select>` for filters
- `admin/audit-logs.vue` → `<Table>`, `<Input>` for search, `<Select>` for filters
- `admin/reports.vue` → `<Card>` for report sections, `<Tabs>` for report types

- [ ] **Step 3: Refactor public pages**

- `index.vue` → `<Button>` for CTAs (keep overall landing page structure)
- `contact.vue` → `<Input>`, `<Textarea>`, `<Select>`, `<Button>`, `<Label>`, `<Alert>` for success/error
- `notifications.vue` → `<Card>` for notification items, `<Button>` for mark-as-read, `<Badge>` for unread indicator
- `privacy.vue`, `terms.vue` → minimal changes, mostly static content. Add `<Card>` wrapper if desired.

- [ ] **Step 4: Commit**

```bash
git add app/pages/legal/ app/pages/admin/ app/pages/index.vue app/pages/contact.vue app/pages/notifications.vue app/pages/privacy.vue app/pages/terms.vue
git commit -m "Refactor legal, admin, and public pages onto shadcn-vue components"
```

---

## Task 17: Create Settings/Preferences Page

**Files:**
- Create: `app/pages/settings/preferences.vue`

- [ ] **Step 1: Create the preferences page**

Create `app/pages/settings/preferences.vue`:

```vue
<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

const preferences = ref({
  emailEnabled: true,
  smsEnabled: true,
  inAppEnabled: true,
});
const isLoading = ref(true);
const isSaving = ref(false);
const success = ref(false);
const error = ref("");

onMounted(async () => {
  try {
    const res = await $fetch<any>("/api/notifications/preferences", {
      headers: getAuthHeaders(),
    });
    if (res.data) {
      preferences.value = {
        emailEnabled: res.data.emailEnabled,
        smsEnabled: res.data.smsEnabled,
        inAppEnabled: res.data.inAppEnabled,
      };
    }
  } catch (e) {
    console.error("Failed to load preferences:", e);
  } finally {
    isLoading.value = false;
  }
});

async function savePreferences() {
  isSaving.value = true;
  success.value = false;
  error.value = "";

  try {
    await $fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: preferences.value,
    });
    success.value = true;
    setTimeout(() => { success.value = false; }, 3000);
  } catch (e: any) {
    error.value = e.data?.message || "Failed to save preferences";
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <PageHeader title="Settings" description="Manage your notification preferences" />

    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <template v-else>
      <Alert v-if="success" class="mb-4">
        <AlertDescription>Preferences saved successfully.</AlertDescription>
      </Alert>

      <Alert v-if="error" variant="destructive" class="mb-4">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Choose how you want to receive notifications about your declarations.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p class="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch v-model:checked="preferences.emailEnabled" />
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <div>
              <Label>SMS Notifications</Label>
              <p class="text-sm text-muted-foreground">Receive updates via text message</p>
            </div>
            <Switch v-model:checked="preferences.smsEnabled" />
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <div>
              <Label>In-App Notifications</Label>
              <p class="text-sm text-muted-foreground">Receive notifications within the portal</p>
            </div>
            <Switch v-model:checked="preferences.inAppEnabled" />
          </div>

          <Separator />

          <div class="flex justify-end">
            <Button @click="savePreferences" :disabled="isSaving">
              {{ isSaving ? "Saving..." : "Save Preferences" }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/settings/preferences.vue
git commit -m "Add notification preferences settings page"
```

---

## Task 18: Create Admin Categories CRUD

**Files:**
- Create: `app/server/api/admin/categories/index.get.ts`
- Create: `app/server/api/admin/categories/index.post.ts`
- Create: `app/server/api/admin/categories/[id].put.ts`
- Create: `app/server/api/admin/categories/[id].delete.ts`
- Create: `app/pages/admin/categories.vue`

- [ ] **Step 1: Create GET endpoint (list all categories for admin)**

Create `app/server/api/admin/categories/index.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const includeInactive = query.includeInactive === "true";

  const where = includeInactive ? {} : { isActive: true };

  const categories = await prisma.publicOfficeCategory.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return {
    success: true,
    data: categories,
  };
});
```

- [ ] **Step 2: Create POST endpoint**

Create `app/server/api/admin/categories/index.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(500).optional(),
  articleReference: z.string().max(50).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const result = categorySchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0]?.message || "Invalid data",
    });
  }

  const category = await prisma.publicOfficeCategory.create({
    data: result.data,
  });

  await createAuditLog(event, {
    userId: event.context.auth.userId,
    action: AuditActions.INSTITUTION_CREATED,
    entityType: "public_office_category",
    entityId: String(category.id),
    newValues: result.data,
  });

  return {
    success: true,
    message: "Category created successfully",
    data: category,
  };
});
```

- [ ] **Step 3: Create PUT endpoint**

Create `app/server/api/admin/categories/[id].put.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(500).optional(),
  articleReference: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: "Invalid category ID" });
  }

  const existing = await prisma.publicOfficeCategory.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, message: "Category not found" });
  }

  const body = await readBody(event);
  const result = updateCategorySchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0]?.message || "Invalid data",
    });
  }

  const category = await prisma.publicOfficeCategory.update({
    where: { id },
    data: result.data,
  });

  await createAuditLog(event, {
    userId: event.context.auth.userId,
    action: AuditActions.INSTITUTION_UPDATED,
    entityType: "public_office_category",
    entityId: String(category.id),
    oldValues: { name: existing.name, description: existing.description, articleReference: existing.articleReference },
    newValues: result.data,
  });

  return {
    success: true,
    message: "Category updated successfully",
    data: category,
  };
});
```

- [ ] **Step 4: Create DELETE endpoint (soft-delete)**

Create `app/server/api/admin/categories/[id].delete.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: "Invalid category ID" });
  }

  const existing = await prisma.publicOfficeCategory.findUnique({ where: { id } });
  if (!existing) {
    throw createError({ statusCode: 404, message: "Category not found" });
  }

  const category = await prisma.publicOfficeCategory.update({
    where: { id },
    data: { isActive: false },
  });

  await createAuditLog(event, {
    userId: event.context.auth.userId,
    action: AuditActions.INSTITUTION_UPDATED,
    entityType: "public_office_category",
    entityId: String(category.id),
    oldValues: { isActive: true },
    newValues: { isActive: false },
  });

  return {
    success: true,
    message: "Category deactivated successfully",
  };
});
```

- [ ] **Step 5: Create admin categories page**

Create `app/pages/admin/categories.vue`:

```vue
<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "~/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

const categories = ref<any[]>([]);
const isLoading = ref(true);
const showDialog = ref(false);
const editingCategory = ref<any>(null);
const form = ref({ name: "", description: "", articleReference: "" });
const isSaving = ref(false);
const error = ref("");

async function fetchCategories() {
  isLoading.value = true;
  try {
    const res = await $fetch<any>("/api/admin/categories?includeInactive=true", {
      headers: getAuthHeaders(),
    });
    categories.value = res.data;
  } catch (e) {
    console.error("Failed to fetch categories:", e);
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editingCategory.value = null;
  form.value = { name: "", description: "", articleReference: "" };
  showDialog.value = true;
}

function openEdit(cat: any) {
  editingCategory.value = cat;
  form.value = {
    name: cat.name,
    description: cat.description || "",
    articleReference: cat.articleReference || "",
  };
  showDialog.value = true;
}

async function saveCategory() {
  isSaving.value = true;
  error.value = "";
  try {
    if (editingCategory.value) {
      await $fetch(`/api/admin/categories/${editingCategory.value.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: form.value,
      });
    } else {
      await $fetch("/api/admin/categories", {
        method: "POST",
        headers: getAuthHeaders(),
        body: form.value,
      });
    }
    showDialog.value = false;
    await fetchCategories();
  } catch (e: any) {
    error.value = e.data?.message || "Failed to save category";
  } finally {
    isSaving.value = false;
  }
}

async function toggleActive(cat: any) {
  try {
    if (cat.isActive) {
      await $fetch(`/api/admin/categories/${cat.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } else {
      await $fetch(`/api/admin/categories/${cat.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: { isActive: true },
      });
    }
    await fetchCategories();
  } catch (e: any) {
    alert(e.data?.message || "Failed to update category status");
  }
}

onMounted(fetchCategories);
</script>

<template>
  <div>
    <PageHeader title="Office Categories" description="Manage public office categories under Article 286(5)">
      <template #actions>
        <Button @click="openCreate">Add Category</Button>
      </template>
    </PageHeader>

    <Card>
      <CardContent class="p-0">
        <div v-if="isLoading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Article Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="cat in categories" :key="cat.id">
              <TableCell class="font-medium">{{ cat.name }}</TableCell>
              <TableCell>{{ cat.articleReference || "—" }}</TableCell>
              <TableCell class="max-w-xs truncate">{{ cat.description || "—" }}</TableCell>
              <TableCell>
                <Badge :class="cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                  {{ cat.isActive ? "Active" : "Inactive" }}
                </Badge>
              </TableCell>
              <TableCell class="text-right space-x-2">
                <Button variant="ghost" size="sm" @click="openEdit(cat)">Edit</Button>
                <Button variant="ghost" size="sm" @click="toggleActive(cat)">
                  {{ cat.isActive ? "Deactivate" : "Reactivate" }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingCategory ? "Edit Category" : "New Category" }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div v-if="error" class="text-sm text-destructive">{{ error }}</div>
          <div>
            <Label for="name">Name</Label>
            <Input id="name" v-model="form.name" placeholder="Category name" />
          </div>
          <div>
            <Label for="articleRef">Article Reference</Label>
            <Input id="articleRef" v-model="form.articleReference" placeholder='e.g., Article 286(5)(a)' />
          </div>
          <div>
            <Label for="description">Description</Label>
            <Input id="description" v-model="form.description" placeholder="Brief description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDialog = false">Cancel</Button>
          <Button @click="saveCategory" :disabled="isSaving || !form.name">
            {{ isSaving ? "Saving..." : "Save" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
```

- [ ] **Step 6: Add Categories to admin navigation in dashboard layout**

In `app/layouts/dashboard.vue`, in the admin navigation items, add:

```typescript
{ name: "Categories", href: "/admin/categories" },
```

- [ ] **Step 7: Commit**

```bash
git add app/server/api/admin/categories/ app/pages/admin/categories.vue app/layouts/dashboard.vue
git commit -m "Add admin categories CRUD with endpoints and page"
```

---

## Task 19: Create Profile Edit Page and Endpoint

**Files:**
- Create: `app/server/api/profile/index.put.ts`
- Create: `app/pages/applicant/profile/edit.vue`

- [ ] **Step 1: Create profile update endpoint**

Create `app/server/api/profile/index.put.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { z } from "zod";

const updateProfileSchema = z.object({
  ghanaCardFrontUrl: z.string().url().optional(),
  ghanaCardBackUrl: z.string().url().optional(),
  designation: z.string().min(2).max(255).optional(),
  institutionId: z.string().uuid().optional(),
  officeCategoryId: z.number().int().positive().optional(),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profile not found. Please complete profile setup first.",
    });
  }

  const body = await readBody(event);
  const result = updateProfileSchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0]?.message || "Invalid data",
    });
  }

  const oldValues = {
    designation: profile.designation,
    institutionId: profile.institutionId,
    officeCategoryId: profile.officeCategoryId,
  };

  const updated = await prisma.applicantProfile.update({
    where: { userId: auth.userId },
    data: result.data,
    include: {
      institution: true,
      officeCategory: true,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.PROFILE_UPDATED,
    entityType: "applicant_profile",
    entityId: updated.id,
    oldValues,
    newValues: result.data,
  });

  return {
    success: true,
    message: "Profile updated successfully",
    data: updated,
  };
});
```

- [ ] **Step 2: Create profile edit page**

Create `app/pages/applicant/profile/edit.vue`:

```vue
<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();

const profile = ref<any>(null);
const institutions = ref<any[]>([]);
const categories = ref<any[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const success = ref(false);
const error = ref("");

const form = ref({
  designation: "",
  institutionId: "",
  officeCategoryId: 0,
  ghanaCardFrontUrl: "",
  ghanaCardBackUrl: "",
});

onMounted(async () => {
  try {
    const [profileRes, instRes, catRes] = await Promise.all([
      $fetch<any>("/api/profile", { headers: getAuthHeaders() }),
      $fetch<any>("/api/institutions"),
      $fetch<any>("/api/categories"),
    ]);

    profile.value = profileRes.data;
    institutions.value = instRes.data || [];
    categories.value = catRes.data || [];

    if (profileRes.data) {
      form.value = {
        designation: profileRes.data.designation || "",
        institutionId: profileRes.data.institutionId || "",
        officeCategoryId: profileRes.data.officeCategoryId || 0,
        ghanaCardFrontUrl: profileRes.data.ghanaCardFrontUrl || "",
        ghanaCardBackUrl: profileRes.data.ghanaCardBackUrl || "",
      };
    }
  } catch (e) {
    console.error("Failed to load profile:", e);
  } finally {
    isLoading.value = false;
  }
});

async function saveProfile() {
  isSaving.value = true;
  success.value = false;
  error.value = "";

  try {
    await $fetch("/api/profile", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: {
        designation: form.value.designation,
        institutionId: form.value.institutionId,
        officeCategoryId: form.value.officeCategoryId,
      },
    });
    success.value = true;
    setTimeout(() => { success.value = false; }, 3000);
  } catch (e: any) {
    error.value = e.data?.message || "Failed to update profile";
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <PageHeader title="Edit Profile" description="Update your office details and information" />

    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <template v-else-if="profile">
      <Alert v-if="success" class="mb-4">
        <AlertDescription>Profile updated successfully.</AlertDescription>
      </Alert>
      <Alert v-if="error" variant="destructive" class="mb-4">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Read-only identity fields -->
      <Card class="mb-6">
        <CardHeader>
          <CardTitle>Identity Information</CardTitle>
          <CardDescription>These fields cannot be changed. Contact an administrator if they need correction.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input :model-value="profile.fullName" disabled />
          </div>
          <div>
            <Label>Ghana Card Number</Label>
            <Input :model-value="profile.ghanaCardNumber" disabled />
          </div>
        </CardContent>
      </Card>

      <!-- Editable office fields -->
      <Card>
        <CardHeader>
          <CardTitle>Office Details</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <Label for="designation">Designation</Label>
            <Input id="designation" v-model="form.designation" />
          </div>
          <div>
            <Label for="institution">Institution</Label>
            <select
              id="institution"
              v-model="form.institutionId"
              class="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
            >
              <option value="">Select institution</option>
              <option v-for="inst in institutions" :key="inst.id" :value="inst.id">
                {{ inst.name }}
              </option>
            </select>
          </div>
          <div>
            <Label for="category">Office Category</Label>
            <select
              id="category"
              v-model.number="form.officeCategoryId"
              class="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
            >
              <option :value="0">Select category</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <Button variant="outline" as-child>
              <NuxtLink to="/applicant/dashboard">Cancel</NuxtLink>
            </Button>
            <Button @click="saveProfile" :disabled="isSaving">
              {{ isSaving ? "Saving..." : "Save Changes" }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
```

- [ ] **Step 3: Add profile edit link to applicant dashboard**

In `app/pages/applicant/dashboard.vue`, add a link/button to edit profile. In the profile section or quick actions, add:

```html
<NuxtLink to="/applicant/profile/edit">
  <Button variant="outline" size="sm">Edit Profile</Button>
</NuxtLink>
```

- [ ] **Step 4: Commit**

```bash
git add app/server/api/profile/index.put.ts app/pages/applicant/profile/edit.vue app/pages/applicant/dashboard.vue
git commit -m "Add profile edit page and PUT endpoint"
```

---

## Task Summary

| Task | Phase | Description | Dependencies |
|------|-------|-------------|--------------|
| 1 | A | Prisma schema: add EmailVerificationToken | None |
| 2 | A | Email service: add sendVerificationEmail | None |
| 3 | A | Wire email sending into auth endpoints | Tasks 1, 2 |
| 4 | A | Create verify-email and resend-verification endpoints | Tasks 1, 2 |
| 5 | A | Create password reset and verify-email pages | Task 4 |
| 6 | A | Add verification banner to applicant dashboard | Task 4 |
| 7 | A | Verify notification wiring (audit) | None |
| 8 | B | Install shadcn-vue components | None |
| 9 | B | Create useApiFetch composable | None |
| 10 | B | Create useAuth, useDeclarations, useNotifications | Task 9 |
| 11 | B | Create shared app components (StatusBadge, ConfirmDialog, NotificationBell, PageHeader, DataTable) | Task 8 |
| 12 | C | Refactor dashboard layout | Tasks 8, 11 |
| 13 | C | Refactor auth pages | Task 8 |
| 14 | C | Refactor applicant pages | Tasks 8, 10, 11 |
| 15 | C | Refactor officer pages | Tasks 8, 10, 11 |
| 16 | C | Refactor legal, admin, and public pages | Tasks 8, 10, 11 |
| 17 | D | Create settings/preferences page | Task 8 |
| 18 | D | Create admin categories CRUD | Task 8 |
| 19 | D | Create profile edit page and endpoint | Task 8 |

**Parallelizable groups:**
- Tasks 1, 2, 7, 8, 9 can all run in parallel (no dependencies)
- Tasks 3, 4 depend on 1+2
- Tasks 10, 11 depend on 8+9
- Tasks 13-16 (page refactoring) can run in parallel once 8+10+11 are done
- Tasks 17, 18, 19 can run in parallel once 8 is done
