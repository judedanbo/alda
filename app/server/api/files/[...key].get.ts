import { getObjectStream, statObjectMeta } from "~/server/services/storage.service";
import { verifyFileSig } from "~/server/utils/file-url";
import { extractClientIp } from "~/server/utils/request-meta";
import { createAuditLogOnce, AuditActions } from "~/server/utils/audit";

// Content-types safe to render inline on this first-party origin. Mirrors what
// the upload sniffer (`detectMagicType`) can ever produce — keep in sync with
// `SupportedUploadType` in server/services/storage.service.ts. Anything else —
// notably text/html and image/svg+xml, which can execute script in the page's
// own origin where the auth tokens live — is forced to download instead.
const INLINE_SAFE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export default defineEventHandler(async (event) => {
  // h3 already percent-decodes route params, so this is the raw signed key.
  const raw = (event.context.params || {}).key;
  const key = Array.isArray(raw) ? raw.join("/") : String(raw || "");

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

  // Compliance: this stateless, signature-gated stream serves applicant
  // documents (Ghana Card scans, reissue letters, receipts). There is no
  // auth context to attribute, but record that the object was fetched —
  // keyed by a coarse document type derived from the bucket-key prefix, not
  // the full key (which is PII-scrubbed anyway). Deduped per (type, IP) so a
  // browser re-fetch or a download flood collapses to one row per minute.
  const documentType = key.split("/")[0] || "unknown";
  await createAuditLogOnce(
    event,
    {
      action: AuditActions.FILE_DOWNLOADED,
      entityType: "file",
      entityId: documentType,
      newValues: { documentType, contentType, sizeBytes: size },
    },
    { key: `${documentType}:${extractClientIp(event)}` },
  );

  // Never trust the stored content-type for inline rendering: re-derive safety
  // at the serving boundary. Allow-listed types render inline; everything else
  // is coerced to an opaque download so a stray text/html or SVG object can't
  // execute as same-origin script. nosniff + a no-op CSP sandbox the response
  // regardless of what bytes the object actually holds.
  const inlineSafe = INLINE_SAFE_TYPES.has(contentType);
  setResponseHeader(event, "Content-Type", inlineSafe ? contentType : "application/octet-stream");
  if (!inlineSafe) {
    const filename = key.split("/").pop() || "download";
    setResponseHeader(event, "Content-Disposition", `attachment; filename="${filename}"`);
  }
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "Content-Security-Policy", "default-src 'none'; sandbox");
  setResponseHeader(event, "Content-Length", size);
  const remaining = Math.max(0, exp - Math.floor(Date.now() / 1000));
  setResponseHeader(event, "Cache-Control", `private, max-age=${remaining}`);

  return sendStream(event, await getObjectStream(key));
});
