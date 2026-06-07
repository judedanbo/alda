# Design: async receipts & uploads (latency follow-up)

Status: **proposed** — not yet implemented. Companion to the latency work that
made notifications non-blocking (`app/server/utils/after-response.ts`).

## Why these two are different from notifications

Notifications were a free win: the handler `await`ed bookkeeping whose result
the response never used, so we just detached it (`runAfterResponse`). Receipts
and uploads are **not** free — their handlers return data the client consumes:

| Endpoint | Slow work on the response path | Client uses the result for… |
| --- | --- | --- |
| `POST /api/receipts/[declarationId]` | `pdf-lib` generation (100–500ms CPU) + MinIO put | `data.receipt.pdfUrl` — officer shows/downloads the PDF (`pages/officer/receipts.vue:84`) |
| `POST /api/upload/ghana-card` (+ `alternate-id`) | multipart read + magic-byte sniff + MinIO put (100ms–5s by file size) | `data.key` to persist on the profile, `data.url` to preview (`pages/applicant/profile/setup.vue:165,196`) |

So making them non-blocking is a **contract change**, not a swap. Each needs a
way for the client to obtain the result after the initial response returns.

---

## Part A — Async receipt generation

### Current flow (synchronous)
`receipts/[declarationId].post.ts`: validate → `generateReceiptPDF()` (blocks) →
`$transaction` creating the `Receipt` row with `pdfUrl = pdfKey` and flipping the
declaration to `SEALED` → audit → `runAfterResponse(sendNotification RECEIPT_READY)`
→ `presignStored(pdfKey)` → return `{ receipt: { ...row, pdfUrl: previewUrl } }`.

### Proposed flow (202 + background job + existing signal)
The signalling rail already exists: a `RECEIPT_READY` notification + the SSE
stream the notification service publishes to. Reuse it.

1. **Handler** does only the cheap, transactional part synchronously:
   - Create the `Receipt` row in a new `PENDING` state (`pdfUrl = null`), flip the
     declaration to `SEALED`, write status history + audit — all in the existing
     `$transaction`. (Decide: does `SEALED` happen now, or only once the PDF
     exists? Recommendation: seal now — the legal fact is the approval+seal, the
     PDF is an artifact. Keeps the state machine unchanged.)
   - Enqueue a `receipt-pdf` BullMQ job `{ receiptId }` (new queue, mirror
     `notification-queue.ts`).
   - Return **202** `{ receipt: { id, status: "PENDING", pdfUrl: null } }`.
2. **Worker** (`receipt-pdf` queue, new plugin mirroring `notification-worker.ts`):
   `generateReceiptPDF()` → update `Receipt.pdfUrl = pdfKey`, `status = "READY"` →
   `sendNotification(RECEIPT_READY)` (move it here from the handler).
3. **Officer UI** (`pages/officer/receipts.vue`): on 202, show "Generating…",
   then either (a) poll `GET /api/receipts/[declarationId]` every ~1.5s until
   `status === "READY"`, or (b) subscribe to the SSE channel already used for
   in-app notifications and react to `RECEIPT_READY`. (a) is simpler and the
   generation is sub-second; (b) is cleaner but needs the officer subscribed.

### Schema change
Add `status` to `Receipt` (`PENDING | READY | FAILED`) and allow `pdfUrl` null.
On `FAILED` (worker exhausts retries), surface a retry affordance in the UI.

### Decisions to lock before building
- **Seal timing**: seal at request time (recommended) vs. only after PDF ready.
- **Signal**: poll (simple, recommended for sub-second gen) vs. SSE (cleaner).
- **Failure UX**: what the officer sees if the PDF job fails after retries.

### Honest cost/benefit
PDF generation is ~100–500ms, single-digit per day per officer. This removes a
sub-second block from a low-frequency action. **Lower priority** than uploads —
do it only if receipt latency is actually observed as a problem, or roll it in
when the BullMQ pattern is already being extended.

---

## Part B — Async / offloaded uploads (higher impact)

Uploads are the bigger latency: file bytes (up to ~5MB Ghana Card images) travel
**through** the app server — multipart parse → magic-byte sniff → MinIO put — so
the app process is occupied for the whole transfer, and the applicant waits.

### Option B1 — Presigned direct-to-MinIO PUT (recommended, biggest win)
Take the bytes off the app server entirely.

1. `POST /api/upload/ghana-card/presign` `{ side, contentType, size }` → server
   validates the claimed type/size, derives the object key (same scheme as
   `uploadGhanaCard`), returns a **presigned PUT URL** + the `key`.
2. Browser `PUT`s the file **straight to MinIO** — never touches the app server.
3. `POST /api/upload/ghana-card/commit` `{ key, side }` → server validates the
   now-uploaded object and records it.

**The hard part — validation.** Today `validateImageFile()` sniffs magic bytes
on the server because it holds the buffer. With a direct PUT the server never
sees the bytes, so move validation into `commit`:
   - server does a MinIO `getObject` of the first N bytes (range read) and runs
     the same magic-byte sniff before accepting the key; reject + delete on fail.
   - constrain the presigned PUT with a content-type condition and a max size so
     a bad actor can't upload arbitrary large blobs.

This is the **core decision**: a range-read sniff in `commit` preserves the
current security property (no trusting client content-type) while keeping bytes
off the app server. Without it, B1 weakens the polyglot defense the current code
deliberately implements.

**Client** (`pages/applicant/profile/setup.vue`): three steps instead of one
(presign → PUT → commit). The preview can use the local `File` (object URL)
immediately, so perceived latency drops even though work remains.

### Option B2 — Keep upload through the app, but stream
Lower-effort, smaller win: keep the single endpoint but stream the body to MinIO
instead of buffering the whole file (`readMultipartFormData` buffers). Reduces
memory and time-to-first-byte but the app process is still in the path. Only
worth it if B1's three-step client change is undesirable.

### Decisions to lock before building
- **B1 vs B2**: offload entirely (B1, recommended) vs. stream-through (B2).
- **Validation placement for B1**: range-read sniff in `commit` (recommended) vs.
  presigned-URL content-type condition only (weaker).
- **Client UX**: local object-URL preview while the PUT runs (recommended).

### Honest cost/benefit
B1 is the single biggest latency win for the applicant flow (removes multi-MB
transfers from the app server, frees a worker thread per upload), but it's the
most code: new presign/commit endpoints, validation relocation, a 3-step client.
B2 is cheap but marginal. Recommend B1 when upload latency/throughput is a real
constraint; otherwise the current synchronous upload is acceptable for low volume.

---

## Suggested sequencing
1. Ship the already-done index + cache-header + notification work; measure.
2. If uploads are the felt pain → **B1**. If receipts → **Part A**.
3. Both reuse the BullMQ + SSE + notification rails already in the codebase, so
   the marginal infra cost is low once the first one is built.
