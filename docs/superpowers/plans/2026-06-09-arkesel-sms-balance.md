# Arkesel SMS Balance Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Check SMS balance" probe to the Notifications → Tools tab that calls Arkesel's balance API and shows remaining SMS units with a low-balance warning.

**Architecture:** A new admin-gated Nitro GET endpoint resolves the effective Arkesel API key via `getCredential("sms.arkesel.apiKey")` (DB override → env), calls Arkesel's v1 balance URL, and returns a normalized status object. A new card in `NotificationTools.vue` renders the result, mirroring the existing SMTP-check card. The low-balance threshold (50 SMS units) lives server-side.

**Tech Stack:** Nuxt 4 / Nitro server routes, Vitest (unit), Vue 3 `<script setup>`, shadcn-vue UI components, `authFetch`.

All commands run from `app/`.

---

### Task 1: Server endpoint — Arkesel balance probe

**Files:**
- Create: `app/server/api/admin/notifications/sms-balance.get.ts`
- Test: `app/test/admin-sms-balance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/test/admin-sms-balance.test.ts`:

```ts
/**
 * Tests for GET /api/admin/notifications/sms-balance — the Arkesel SMS-credit
 * probe. Mocks prisma (admin role check), getCredential (effective-key
 * resolution), and global fetch (Arkesel response).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn() },
}));
const getCredentialMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/notification-config", () => ({ getCredential: getCredentialMock }));

const handler = (await import("~/server/api/admin/notifications/sms-balance.get")).default;

function adminEvent() {
  return {
    context: { auth: { userId: "admin-1", email: "admin@example.com", roles: ["admin"] } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/admin/notifications/sms-balance", () => {
  it("rejects unauthenticated callers with 401", async () => {
    const event = adminEvent();
    event.context.auth = undefined;
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects non-admins with 403", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "schedule_officer" } }]);
    getCredentialMock.mockResolvedValue("key");
    await expect(handler(adminEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("reports configured:false when no Arkesel key is set", async () => {
    getCredentialMock.mockResolvedValue("");
    const res = await handler(adminEvent());
    expect(res).toEqual({ ok: false, configured: false });
  });

  it("returns the balance with low:false when above the threshold", async () => {
    getCredentialMock.mockResolvedValue("key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ balance: 717, user: "Richard Mensah", country: "Ghana" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({
      ok: true, configured: true, balance: 717, user: "Richard Mensah",
      country: "Ghana", low: false, threshold: 50,
    });
  });

  it("flags low:true when the balance is below the threshold", async () => {
    getCredentialMock.mockResolvedValue("key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ balance: 30, user: "Richard Mensah", country: "Ghana" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({ ok: true, low: true, balance: 30, threshold: 50 });
  });

  it("returns ok:false with a hint when Arkesel rejects the key", async () => {
    getCredentialMock.mockResolvedValue("bad-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: "Invalid API Key" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({ ok: false, configured: true, hint: "Invalid API Key" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/admin-sms-balance.test.ts`
Expected: FAIL — cannot resolve `~/server/api/admin/notifications/sms-balance.get` (module does not exist yet).

- [ ] **Step 3: Write the endpoint**

Create `app/server/api/admin/notifications/sms-balance.get.ts`:

```ts
import prisma from "~/server/utils/prisma";
import { getCredential } from "~/server/utils/notification-config";

/**
 * On-demand Arkesel SMS-credit probe. Admin-only.
 *
 * Calls Arkesel's v1 balance endpoint (sms.arkesel.com/sms/api) — note this is
 * a DIFFERENT base path from the v2 send endpoint used by sendViaArkesel in
 * sms.service.ts (/api/v2/sms/send). Same account + API key, two API versions;
 * do not "align" them.
 *
 * GET /api/admin/notifications/sms-balance
 */

// Remaining SMS units below which the UI shows a top-up warning.
const LOW_BALANCE_THRESHOLD = 50;

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!userRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  // Resolve the SAME effective key the sender uses (DB override → env → "").
  const apiKey = await getCredential("sms.arkesel.apiKey");
  if (!apiKey) {
    return { ok: false, configured: false };
  }

  try {
    const url =
      "https://sms.arkesel.com/sms/api?action=check-balance&api_key=" +
      encodeURIComponent(apiKey);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = (await response.json()) as {
      balance?: number | string;
      user?: string;
      country?: string;
      message?: string;
    };

    // Arkesel v1 may serialize the balance as a string; coerce defensively.
    const balance = typeof data.balance === "string" ? Number(data.balance) : data.balance;

    // The balance fields are only present on success; their absence (or a
    // non-2xx) means the key was rejected or the account is invalid.
    if (!response.ok || balance == null || Number.isNaN(balance)) {
      return {
        ok: false,
        configured: true,
        hint: data.message || "Arkesel rejected the balance request — check the API key.",
      };
    }

    return {
      ok: true,
      configured: true,
      balance,
      user: data.user,
      country: data.country,
      low: balance < LOW_BALANCE_THRESHOLD,
      threshold: LOW_BALANCE_THRESHOLD,
    };
  } catch (error) {
    // Transport failure or non-JSON body — distinct from a reachable-but-
    // rejected key (handled above). Log server-side, surface a 502 the UI
    // shows as a generic failure.
    console.error("Arkesel balance check failed:", error);
    throw createError({
      statusCode: 502,
      statusMessage: "Could not reach the Arkesel balance API.",
    });
  }
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/admin-sms-balance.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/server/api/admin/notifications/sms-balance.get.ts app/test/admin-sms-balance.test.ts
git commit -m "Add admin Arkesel SMS-balance probe endpoint"
```

---

### Task 2: UI card in NotificationTools.vue

**Files:**
- Modify: `app/components/admin/NotificationTools.vue` (script: add balance state + fetcher; template: add card)

No Vue component unit test — this codebase tests server endpoints, not components. Verification is typecheck + lint + manual smoke (Task 3).

- [ ] **Step 1: Add the balance state and fetcher to `<script setup>`**

In `app/components/admin/NotificationTools.vue`, locate the end of the SMTP block (just after the `checkSmtp()` function closes). Insert this block immediately after it, before the closing `</script>`:

```ts
// Arkesel SMS-credit probe — mirrors the SMTP check above. The endpoint returns
// HTTP 200 even when ok:false (unset/invalid key), so a thrown error here means
// a transport failure (5xx), surfaced separately from a bad-key result.
type SmsBalance = {
  ok: boolean;
  configured: boolean;
  balance?: number;
  user?: string;
  country?: string;
  low?: boolean;
  threshold?: number;
  hint?: string;
};

const checkingBalance = ref(false);
const balanceResult = ref<SmsBalance | null>(null);
const balanceError = ref<string | null>(null);

async function checkSmsBalance() {
  checkingBalance.value = true;
  balanceResult.value = null;
  balanceError.value = null;
  try {
    balanceResult.value = await authFetch<SmsBalance>("/api/admin/notifications/sms-balance");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    balanceError.value = e.data?.message || e.data?.statusMessage || "SMS balance check failed";
  } finally {
    checkingBalance.value = false;
  }
}
```

- [ ] **Step 2: Add the card to the template**

In the same file, find the SMTP `<Card class="mb-4">…</Card>` block (titled "Email server (SMTP) connection"). Insert this new card immediately **after** that closing `</Card>` and **before** the `<Card>` titled "Send test notification":

```vue
    <Card class="mb-4">
      <CardHeader>
        <CardTitle>SMS balance (Arkesel)</CardTitle>
        <CardDescription>
          Checks the remaining SMS credit on the Arkesel account using the API key currently in
          effect (a Settings-tab override, otherwise the deployment's env value).
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="balanceError" variant="destructive">
          <AlertDescription>{{ balanceError }}</AlertDescription>
        </Alert>

        <Alert
          v-else-if="balanceResult"
          :variant="balanceResult.ok && !balanceResult.low ? undefined : 'destructive'"
        >
          <AlertDescription>
            <template v-if="balanceResult.ok">
              <span class="font-medium">
                {{ balanceResult.low ? "🟠" : "🟢" }} {{ balanceResult.balance }} SMS remaining
              </span>
              <span v-if="balanceResult.user" class="block text-xs mt-1 font-mono">
                {{ balanceResult.user }}<template v-if="balanceResult.country"> ·
                  {{ balanceResult.country }}</template>
              </span>
              <span v-if="balanceResult.low" class="block text-xs mt-1">
                Top up soon — below {{ balanceResult.threshold }} SMS.
              </span>
            </template>
            <template v-else-if="!balanceResult.configured">
              <span class="font-medium">🔴 No Arkesel API key set</span>
              <span class="block text-xs mt-1">Add it on the Settings tab.</span>
            </template>
            <template v-else>
              <span class="font-medium">🔴 Balance check failed</span>
              <span v-if="balanceResult.hint" class="block text-xs mt-1">{{ balanceResult.hint }}</span>
            </template>
          </AlertDescription>
        </Alert>

        <Button :disabled="checkingBalance" @click="checkSmsBalance">
          <span v-if="checkingBalance">Checking...</span>
          <span v-else>Check SMS balance</span>
        </Button>
      </CardContent>
    </Card>
```

(`Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Button`, `Alert`, `AlertDescription`, and `authFetch` are already imported/available in this file — no new imports needed.)

- [ ] **Step 3: Typecheck the change**

Run: `npx nuxi typecheck`
Expected: no new errors referencing `NotificationTools.vue` or `sms-balance`.

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/NotificationTools.vue
git commit -m "Surface Arkesel SMS balance in notification tools UI"
```

---

### Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS, including the new `admin-sms-balance.test.ts`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new lint errors in the two changed files.

- [ ] **Step 3: Typecheck**

Run: `npx nuxi typecheck`
Expected: clean (CI runs this; it must pass before pushing — per project memory).

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run `npm run dev`, log in as an admin, open Notifications → Tools, click **Check SMS balance**. With a real Arkesel key set (Settings tab or env) you should see `🟢 <n> SMS remaining · <account> · Ghana`; with no key, the "No Arkesel API key set" state.

---

## Notes for the implementer

- **Do not** read `process.env.ARKESEL_API_KEY` in the endpoint. `getCredential("sms.arkesel.apiKey")` is the only correct source — it honours an admin's DB override and falls back to env, matching what `sms.service.ts` actually sends with.
- The balance URL is Arkesel **v1** and intentionally differs from the **v2** send endpoint in `sms.service.ts`. The code comment in the endpoint says so; keep it.
- `balance` is a count of **SMS units**; the warning threshold is **50 units**, defined once as `LOW_BALANCE_THRESHOLD` in the endpoint.
