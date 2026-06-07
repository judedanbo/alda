# App-signed image proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-facing MinIO presigned URLs with same-origin, HMAC-signed, time-limited `/api/files/...` URLs served by a new streaming route, so private-file previews render without exposing MinIO or triggering mixed-content blocks.

**Architecture:** Change the single seam every consumer flows through — `presignStored`/`presignFresh` in `storage.service.ts` — to emit app-signed URLs. A new public (capability-authed) route `/api/files/[...key]` verifies the HMAC + expiry and streams bytes from internal MinIO. Pure signing logic lives in `server/utils/file-url.ts`.

**Tech Stack:** Nuxt 4 / Nitro server routes, `node:crypto` (HMAC-SHA256, timingSafeEqual), the `minio` client (`getObject`/`statObject`), Vitest.

**Builds on (already changed, uncommitted on this branch):** the `storageOp(...)` helper in `storage.service.ts` (Phase 3 error hardening) and the `NUXT_`-prefix k8s config fix. This plan extends `storageOp` and the presign helpers.

---

### Task 1: Pure signing helper `file-url.ts`

**Files:**
- Create: `app/server/utils/file-url.ts`
- Test: `app/test/file-url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/test/file-url.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({ jwtSecret: "unit-test-secret" }));
});

const { signFileUrl, verifyFileSig } = await import("~/server/utils/file-url");

function parse(url: string) {
  const [path, qs] = url.split("?");
  const q = new URLSearchParams(qs);
  return { path, exp: Number(q.get("exp")), sig: q.get("sig") || "" };
}

describe("signFileUrl / verifyFileSig", () => {
  it("round-trips: a freshly signed url verifies", () => {
    const url = signFileUrl("ghana-cards/abc/front.jpg", 900);
    const { path, exp, sig } = parse(url);
    expect(path).toBe("/api/files/ghana-cards/abc/front.jpg");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyFileSig("ghana-cards/abc/front.jpg", exp, sig)).toBe(true);
  });

  it("rejects an expired url", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", -10)); // exp in the past
    expect(verifyFileSig("k/x.jpg", exp, sig)).toBe(false);
  });

  it("rejects a tampered key", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/other.jpg", exp, sig)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(verifyFileSig("k/x.jpg", exp, flipped)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/x.jpg", exp + 1000, sig)).toBe(false);
  });

  it("rejects a non-integer expiry", () => {
    const { sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/x.jpg", Number.NaN, sig)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/file-url.test.ts`
Expected: FAIL — `Cannot find module '~/server/utils/file-url'`.

- [ ] **Step 3: Write the implementation**

> Learning-mode: scaffold this file with the imports, constant, `computeSig`/`encodeKeyPath` helpers, and the two exported signatures + doc comments, then have the user write the bodies of `signFileUrl` and `verifyFileSig`. The block below is the reference solution.

```ts
// app/server/utils/file-url.ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Default lifetime of a signed file URL (matches the old presign TTL). */
export const DEFAULT_FILE_URL_TTL_SECONDS = 900;

/** HMAC key — reuse the server JWT secret (one-way; cannot leak the JWT key). */
function signingSecret(): string {
  return useRuntimeConfig().jwtSecret as string;
}

/** Deterministic signature over the exact key + expiry. */
function computeSig(key: string, exp: number): string {
  return createHmac("sha256", signingSecret()).update(`${key}\n${exp}`).digest("hex");
}

/** URL-encode each path segment but keep "/" separators. */
function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Mint a same-origin, time-limited URL for a bucket-relative MinIO key. */
export function signFileUrl(key: string, ttlSeconds: number = DEFAULT_FILE_URL_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = computeSig(key, exp);
  return `/api/files/${encodeKeyPath(key)}?exp=${exp}&sig=${sig}`;
}

/** True only when `sig` matches `key`+`exp` and `exp` is still in the future. */
export function verifyFileSig(key: string, exp: number, sig: string): boolean {
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  if (typeof sig !== "string" || sig.length === 0) return false;
  const expected = Buffer.from(computeSig(key, exp), "hex");
  const provided = Buffer.from(sig, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/file-url.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/server/utils/file-url.ts app/test/file-url.test.ts
git commit -m "feat(storage): HMAC-signed same-origin file URL helper"
```

---

### Task 2: Point the presign helpers at signed URLs + add stream/stat helpers

**Files:**
- Modify: `app/server/services/storage.service.ts`
- Test: `app/test/storage-presign.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to the existing file)**

Append this block to `app/test/storage-presign.test.ts`, and add `jwtSecret` to the existing `vi.stubGlobal("useRuntimeConfig", ...)` object in its `beforeEach` (so signing works):

```ts
// add `jwtSecret: "unit-test-secret",` to the useRuntimeConfig stub object above.

import { verifyFileSig } from "~/server/utils/file-url";

const { presignStored } = await import("~/server/services/storage.service");

describe("presignStored → app-signed URL", () => {
  function parse(url: string) {
    const [path, qs] = url.split("?");
    const q = new URLSearchParams(qs);
    return { path, exp: Number(q.get("exp")), sig: q.get("sig") || "" };
  }

  it("signs a bare key into a verifiable /api/files URL", async () => {
    const url = await presignStored("ghana-cards/abc/front.jpg");
    const { path, exp, sig } = parse(url!);
    expect(path).toBe("/api/files/ghana-cards/abc/front.jpg");
    expect(verifyFileSig("ghana-cards/abc/front.jpg", exp, sig)).toBe(true);
  });

  it("normalizes a legacy absolute URL then signs the key", async () => {
    const url = await presignStored(
      "http://localhost:9000/adla-uploads/receipts/RCP-1.pdf",
    );
    const { path, exp, sig } = parse(url!);
    expect(path).toBe("/api/files/receipts/RCP-1.pdf");
    expect(verifyFileSig("receipts/RCP-1.pdf", exp, sig)).toBe(true);
  });

  it("returns null for empty input", async () => {
    expect(await presignStored("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/storage-presign.test.ts`
Expected: FAIL — `presignStored` currently returns a MinIO presigned URL (calls `getMinioClient`), not `/api/files/...`.

- [ ] **Step 3: Implement the changes in `storage.service.ts`**

3a. Add imports near the top (after the existing `minio`/`crypto` imports):

```ts
import type { Readable } from "node:stream";
import { signFileUrl, DEFAULT_FILE_URL_TTL_SECONDS } from "~/server/utils/file-url";
```

3b. Delete the local `const DEFAULT_PRESIGN_TTL_SECONDS = 900;` line and replace every use of `DEFAULT_PRESIGN_TTL_SECONDS` with `DEFAULT_FILE_URL_TTL_SECONDS` (the `presignFresh` default and the `presignStored` default parameter).

3c. Extend `storageOp` to map MinIO "not found" to a 404 (replace the whole function):

```ts
const NOT_FOUND_CODES = new Set(["NoSuchKey", "NotFound", "NoSuchObject"]);

async function storageOp<T>(
  operation: string,
  ctx: Record<string, unknown>,
  fn: () => Promise<T>,
  opts: { notFoundIs404?: boolean } = {},
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    const code = (err as { code?: string })?.code;
    if (opts.notFoundIs404 && code && NOT_FOUND_CODES.has(code)) {
      throw createError({ statusCode: 404, statusMessage: "Not Found", message: "File not found." });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[storage] ${operation} failed`, { ...ctx, error: detail });
    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      message: "Storage backend is unavailable. Please try again shortly.",
    });
  }
}
```

3d. Replace `presignFresh` so it signs instead of calling MinIO:

```ts
async function presignFresh(key: string, ttlSeconds = DEFAULT_FILE_URL_TTL_SECONDS): Promise<string> {
  // Same-origin app-signed URL (served by /api/files) — never a MinIO presigned
  // URL, which would point at the internal endpoint and be unreachable + mixed
  // content in the browser.
  return signFileUrl(key, ttlSeconds);
}
```

3e. Replace the body of `getPresignedUrl` (keep its signature) with:

```ts
  return signFileUrl(key, expirySeconds);
```

(Remove the now-unused `getMinioClient()`/`config` lines inside `getPresignedUrl`.)

3f. Add stream + stat helpers (place them after `getPresignedUrl`):

```ts
/** Read a stored object's bytes as a stream (internal MinIO). For /api/files. */
export async function getObjectStream(key: string): Promise<Readable> {
  const config = useRuntimeConfig();
  const client = getMinioClient();
  return storageOp(
    "getObject",
    { bucket: config.minioBucket, key },
    () => client.getObject(config.minioBucket, key),
    { notFoundIs404: true },
  );
}

/** Stat a stored object: byte length + trusted content-type. For /api/files. */
export async function statObjectMeta(key: string): Promise<{ size: number; contentType: string }> {
  const config = useRuntimeConfig();
  const client = getMinioClient();
  const stat = await storageOp(
    "statObject",
    { bucket: config.minioBucket, key },
    () => client.statObject(config.minioBucket, key),
    { notFoundIs404: true },
  );
  return {
    size: stat.size,
    contentType: (stat.metaData?.["content-type"] as string) || "application/octet-stream",
  };
}
```

3g. `presignStored` itself needs no body change — it already calls `parseStoredKey` then `presignFresh`, which now returns a signed URL.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/storage-presign.test.ts`
Expected: PASS (existing `parseStoredKey` tests + 3 new `presignStored` tests).

- [ ] **Step 5: Commit**

```bash
git add app/server/services/storage.service.ts app/test/storage-presign.test.ts
git commit -m "feat(storage): presign helpers emit app-signed URLs; add object stream/stat"
```

---

### Task 3: The `/api/files/[...key]` route + auth allow-list

**Files:**
- Create: `app/server/api/files/[...key].get.ts`
- Modify: `app/server/middleware/auth.ts` (add `/api/files` to `publicRoutes`)
- Test: `app/test/files-route.test.ts`

- [ ] **Step 1: Add `/api/files` to the public allow-list**

In `app/server/middleware/auth.ts`, add the entry to the `publicRoutes` array (alongside `/api/health` etc.):

```ts
  // Capability-authed by the URL signature (an <img> request can't carry a
  // Bearer token); the handler verifies the HMAC + expiry itself.
  "/api/files",
```

- [ ] **Step 2: Write the failing route test**

```ts
// app/test/files-route.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const storageMock = vi.hoisted(() => ({
  statObjectMeta: vi.fn(),
  getObjectStream: vi.fn(),
}));
vi.mock("~/server/services/storage.service", () => storageMock);

const getQueryMock = vi.hoisted(() => vi.fn());
const setResponseHeaderMock = vi.hoisted(() => vi.fn());
const sendStreamMock = vi.hoisted(() => vi.fn(() => "STREAM"));
vi.stubGlobal("getQuery", getQueryMock);
vi.stubGlobal("setResponseHeader", setResponseHeaderMock);
vi.stubGlobal("sendStream", sendStreamMock);
vi.stubGlobal("useRuntimeConfig", () => ({ jwtSecret: "unit-test-secret" }));
vi.stubGlobal("createError", (e: { statusCode: number; message?: string }) => {
  const err = new Error(e.message || "error") as Error & { statusCode: number };
  err.statusCode = e.statusCode;
  return err;
});

const { signFileUrl } = await import("~/server/utils/file-url");
const handler = (await import("~/server/api/files/[...key].get")).default;

function eventFor(url: string) {
  const [, qs] = url.split("?");
  const q = new URLSearchParams(qs);
  getQueryMock.mockReturnValue({ exp: q.get("exp"), sig: q.get("sig") });
  return { context: { params: { key: "ghana-cards/abc/front.jpg" } } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.statObjectMeta.mockResolvedValue({ size: 1234, contentType: "image/jpeg" });
  storageMock.getObjectStream.mockResolvedValue("READABLE");
  sendStreamMock.mockReturnValue("STREAM");
});

describe("GET /api/files/[...key]", () => {
  it("streams the object for a valid signature", async () => {
    const res = await handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", 900)));
    expect(storageMock.statObjectMeta).toHaveBeenCalledWith("ghana-cards/abc/front.jpg");
    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), "Content-Type", "image/jpeg");
    expect(sendStreamMock).toHaveBeenCalledWith(expect.anything(), "READABLE");
    expect(res).toBe("STREAM");
  });

  it("403s an invalid signature", async () => {
    const url = signFileUrl("ghana-cards/abc/front.jpg", 900).replace(/sig=.+$/, "sig=deadbeef");
    await expect(handler(eventFor(url))).rejects.toMatchObject({ statusCode: 403 });
    expect(storageMock.statObjectMeta).not.toHaveBeenCalled();
  });

  it("403s an expired signature", async () => {
    await expect(handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", -10))))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("propagates a 404 when the object is missing", async () => {
    const err = Object.assign(new Error("not found"), { statusCode: 404 });
    storageMock.statObjectMeta.mockRejectedValueOnce(err);
    await expect(handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", 900))))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/files-route.test.ts`
Expected: FAIL — `Cannot find module '~/server/api/files/[...key].get'`.

- [ ] **Step 4: Write the route handler**

```ts
// app/server/api/files/[...key].get.ts
import { getObjectStream, statObjectMeta } from "~/server/services/storage.service";
import { verifyFileSig } from "~/server/utils/file-url";

export default defineEventHandler(async (event) => {
  // Reconstruct the exact bucket-relative key the URL was signed over.
  const raw = (event.context.params || {}).key;
  const key = (Array.isArray(raw) ? raw.join("/") : String(raw || ""))
    .split("/")
    .map(decodeURIComponent)
    .join("/");

  const q = getQuery(event);
  const exp = Number(q.exp);
  const sig = typeof q.sig === "string" ? q.sig : "";

  if (!key || !verifyFileSig(key, exp, sig)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Invalid or expired file link.",
    });
  }

  // statObjectMeta / getObjectStream map a missing object to 404 and any other
  // MinIO failure to a logged 502 (via storageOp).
  const { contentType, size } = await statObjectMeta(key);
  setResponseHeader(event, "Content-Type", contentType);
  setResponseHeader(event, "Content-Length", size);
  const remaining = Math.max(0, exp - Math.floor(Date.now() / 1000));
  setResponseHeader(event, "Cache-Control", `private, max-age=${remaining}`);

  return sendStream(event, await getObjectStream(key));
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/files-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/server/api/files/ app/server/middleware/auth.ts app/test/files-route.test.ts
git commit -m "feat(storage): /api/files signed streaming route + auth allow-list"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `cd app && npm run lint`
Expected: no errors.

- [ ] **Step 2: Run the full affected test set**

Run: `npx vitest run test/file-url.test.ts test/storage-presign.test.ts test/files-route.test.ts test/upload-validation.test.ts`
Expected: all PASS.

- [ ] **Step 3: Run the whole unit suite to catch regressions**

Run: `npx vitest run`
Expected: all PASS (no consumer of `presignStored`/`getPresignedUrl` broke).

- [ ] **Step 4: Manual check (after deploy)**

On staging, open the applicant profile / a declaration detail with uploaded images. In DevTools → Network, confirm the `<img>` requests hit `/api/files/...` on the app origin and return `200` with `image/jpeg`, and there is no mixed-content console warning.

---

## Notes for the executor

- `defineEventHandler`, `getQuery`, `createError`, `setResponseHeader`, `sendStream`, and `useRuntimeConfig` are Nitro/h3 **auto-imports** — do not add explicit imports for them in route/handler files (tests stub them via `vi.stubGlobal`).
- The catch-all param for `[...key].get.ts` arrives as `event.context.params.key`. Keys are URL-safe (uuid / cuid / `front|back` / sanitized type), so the per-segment encode/decode is effectively a no-op but kept for correctness.
- This branch also carries the `NUXT_`-prefix k8s fix and the Phase-3 `storageOp` hardening (uncommitted at plan time). Keep those as their own commits; the staging deploy of the config fix is independent of merging this feature.
