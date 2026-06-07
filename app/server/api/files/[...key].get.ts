import { getObjectStream, statObjectMeta } from "~/server/services/storage.service";
import { verifyFileSig } from "~/server/utils/file-url";

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
  setResponseHeader(event, "Content-Type", contentType);
  setResponseHeader(event, "Content-Length", size);
  const remaining = Math.max(0, exp - Math.floor(Date.now() / 1000));
  setResponseHeader(event, "Cache-Control", `private, max-age=${remaining}`);

  return sendStream(event, await getObjectStream(key));
});
