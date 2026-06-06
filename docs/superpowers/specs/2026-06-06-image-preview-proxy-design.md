# App-signed image proxy (private-file previews) — design

**Date:** 2026-06-06
**Status:** Approved for planning

## Problem

Private uploads (Ghana Card images, alternate-ID scans, reissue letters, receipt
PDFs) live in a **private** MinIO bucket. On read, the server hands the browser a
**presigned URL** minted by the MinIO client (`presignStored`/`presignFresh` in
`app/server/services/storage.service.ts`). The MinIO client signs against the
endpoint it dials — in-cluster that is `http://adla-minio:9000`. So every
browser-facing preview URL is `http://adla-minio:9000/adla-uploads/...?X-Amz-…`,
which is:

- **unreachable** from the browser (internal cluster DNS), and
- **mixed content** (plain `http://` embedded in an `https://` page), hence
  blocked by the browser.

Result: every stored-image preview is broken in production/staging. This has been
true since the bucket went private (commit `a2672e4`); it is independent of the
`localhost`/`NUXT_`-prefix runtime-config bug fixed separately on the same branch
lineage. ~15 endpoints return these URLs (profile, declarations, legal
verifications, receipts, reissues), all via the two shared helpers.

## Goal

Render private files in the browser **without** exposing MinIO publicly and
**without** mixed content, by replacing presigned URLs at the shared seam with
**same-origin, app-signed, time-limited** URLs that a new app route verifies and
streams from internal MinIO.

## Approach (chosen)

App-signed proxy route. Rejected alternatives: exposing MinIO via a public
ingress + cert (exposes storage, needs DNS/CORS ops), and a JWT-authed proxy
(`<img src>` can't send a Bearer header). The chosen approach preserves the exact
capability-URL security model already in use (TTL-bounded bearer), but
same-origin and with MinIO never exposed.

## URL shape

```
/api/files/<bucket-relative-key>?exp=<unix-seconds>&sig=<hex-hmac>
e.g. /api/files/ghana-cards/<userId>/front.jpg?exp=1749250000&sig=a1b2c3…
```

The signature binds the **exact key + expiry**, so a client cannot fetch a key
the server did not sign for it (no path traversal / SSRF), and cannot extend the
lifetime.

## Components

### New `app/server/utils/file-url.ts`
Pure, no I/O (unit-testable in isolation). Secret = `runtimeConfig.jwtSecret`
(already provisioned + boot-gated; HMAC is one-way so the JWT key cannot leak).

- `signFileUrl(key: string, ttlSeconds?: number): string`
  - `exp = nowSeconds + ttlSeconds` (default `DEFAULT_PRESIGN_TTL_SECONDS`, 900).
  - `sig = hmacSha256Hex(secret, `${key}\n${exp}`)`.
  - Returns `/api/files/${encodePath(key)}?exp=${exp}&sig=${sig}`, where
    `encodePath` URL-encodes each segment but keeps `/` separators.
- `verifyFileSig(key: string, exp: number, sig: string): boolean`
  - Reject if `exp` is not a finite integer or `exp <= nowSeconds`.
  - Recompute the HMAC and compare with `crypto.timingSafeEqual` (length-guarded).

> Learning-mode note: the file is scaffolded with signatures, doc comments, and a
> TODO; the user implements the ~10-line body of `signFileUrl` + `verifyFileSig`
> (token layout, expiry check, timing-safe compare) — the meaningful decisions.

### New route `app/server/api/files/[...key].get.ts`
- Reconstruct the bucket-relative `key` from the catch-all param
  (`Array.isArray(params.key) ? params.key.join("/") : params.key`, then
  `decodeURIComponent` per segment) — must equal the signed key byte-for-byte.
- Read `exp` (Number) and `sig` (String) from query.
- `verifyFileSig(key, exp, sig)` → `403` on missing/expired/tampered signature.
- `statObject(key)` → `Content-Type` (`metaData["content-type"]`, fallback
  `application/octet-stream`) + `Content-Length`. `getObject(key)` → stream the
  body. Both wrapped by the existing `storageOp` helper (→ `404` on
  `NoSuchKey`/`NotFound`, `502` + log on other MinIO failure).
- `Cache-Control: private, max-age=<remaining TTL, floored at 0>`.

### Edits
- `app/server/services/storage.service.ts`
  - `presignFresh(key, ttl)` → `return signFileUrl(key, ttl)` (no MinIO call).
  - `presignStored(stored, ttl)` → `parseStoredKey` (unchanged; normalizes bare
    keys + legacy absolute-URL rows) then `signFileUrl(key, ttl)`.
  - `getPresignedUrl(key, expiry)` → `signFileUrl(key, expiry)` for consistency.
  - Add `getObjectStream(key)` (and `statObjectMeta(key)`) helpers wrapping
    `client.getObject` / `client.statObject` via `storageOp`, for the route.
  - `DEFAULT_PRESIGN_TTL_SECONDS` stays the canonical TTL.
- `app/server/middleware/auth.ts`
  - Add `"/api/files"` to `publicRoutes` (capability-authed by the signature; a
    JWT cannot ride on an `<img>` request).

### Out of scope (verified)
- `app/server/services/pdf.service.ts` — generates and **stores** PDFs; it does
  not fetch images server-side, so no change.
- MinIO bucket policy — stays private (`denyAnonymousPolicy`).
- The `NUXT_`-prefix runtime-config fix and `storageOp` 502 hardening — already
  done on this branch lineage.

## Data flow

1. Page endpoint (e.g. `GET /api/profile`) calls
   `presignStored(profile.ghanaCardFrontUrl)` →
   `/api/files/ghana-cards/<uid>/front.jpg?exp=…&sig=…`.
2. Browser renders `<img src="/api/files/…">` — same origin, signature is the
   capability; no Bearer needed.
3. `GET /api/files/…` → auth middleware skips it (public list) → route verifies
   sig+exp → streams bytes from internal MinIO → image renders.

Signed URLs are minted fresh on every server render, so a page load always
carries a valid-for-TTL URL. An `<img>` whose URL expires while the page sits
open will `403` on a later reload — identical to presigned-URL behavior today.

## Error handling

| Condition | Response |
|---|---|
| Missing/garbled `exp`/`sig`, tampered key, or `exp <= now` | `403` |
| Object absent in MinIO (`NoSuchKey`/`NotFound`) | `404` |
| Other MinIO failure (conn refused, TLS, AccessDenied) | `502` + `[storage]` log (via `storageOp`) |

## Security model

- Capability URL, TTL-bounded — same trust model as the presigned URLs it
  replaces, but **same-origin** and with MinIO **never exposed**.
- HMAC-SHA256 over `key\nexp` with the server JWT secret; `timingSafeEqual`
  comparison; expiry enforced server-side.
- The sig binds the exact key string the server generated, so clients cannot
  forge or mutate a key (no traversal). Keys are server-side, URL-safe
  (uuid / cuid / `front|back` / sanitized type).
- Key paths (incl. owner `userId`) appear in the URL — no worse than presigned
  URLs today, which also embed the full key.

## Testing

- `test/file-url.test.ts` (new): sign→verify round-trip; reject expired; reject
  tampered key / `exp` / `sig`; non-numeric `exp`; constant-time path exercised.
- `test/storage-presign.test.ts` (update): assert `presignStored` returns the
  `/api/files/...?exp=&sig=` shape for a bare key and a legacy absolute-URL row;
  signature verifies.
- `test/files-route.test.ts` (new): valid sig streams mocked MinIO bytes with the
  right `Content-Type`; invalid sig → `403`; expired → `403`; missing object →
  `404`.

## Verification (end-to-end)

- `cd app && npm run lint && npx vitest run test/file-url.test.ts test/storage-presign.test.ts test/files-route.test.ts`.
- Manual: on staging, open the applicant profile / a declaration detail with
  uploaded images; confirm thumbnails render (DevTools: the `<img>` requests hit
  `/api/files/...` on the app origin and return `200 image/jpeg`, no mixed-content
  console error).
