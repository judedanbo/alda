import { Client } from "minio";
import { randomUUID } from "crypto";

let minioClient: Client | null = null;

/**
 * The bucket holds national-ID images, alternate-ID scans, reissue letters,
 * and receipt PDFs. None of it is public.
 *
 * The policy is intentionally an empty statement set. This overwrites any
 * pre-existing anonymous-allow policy (e.g. left over from `mc anonymous
 * set download` in older dev setups) without introducing an explicit Deny
 * that risks blocking authenticated server-side operations on MinIO
 * versions where `aws:PrincipalType: Anonymous` isn't honored. With no
 * Allow rule in effect, S3's default-deny applies to anonymous traffic;
 * authenticated callers presenting our access key continue to work.
 */
function denyAnonymousPolicy(): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [],
  });
}

const DEFAULT_PRESIGN_TTL_SECONDS = 900;

/** Get or create MinIO client. */
function getMinioClient(): Client {
  if (!minioClient) {
    const config = useRuntimeConfig();
    minioClient = new Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      // Server-to-MinIO TLS. False for the local dev stack; true for any
      // production deploy whose MinIO link crosses a network segment.
      useSSL: config.minioUseSSL,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
    });
  }
  return minioClient;
}

/**
 * Ensure the bucket exists AND assert a deny-anonymous policy on every boot.
 * Idempotent: setBucketPolicy overwrites, so this is the durable source of
 * truth for the bucket being private even if a dev compose script or a hand-
 * applied policy says otherwise.
 */
async function ensureBucket(bucketName: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName);
  }
  try {
    await client.setBucketPolicy(bucketName, denyAnonymousPolicy());
  } catch (err) {
    // Setting a bucket policy can fail on an under-privileged access key.
    // Surface it loudly — a silent failure here means the bucket is wide
    // open. Server keeps starting (so health endpoints stay reachable) but
    // the operator sees the warning.
    console.error("[storage] failed to assert deny-anonymous bucket policy:", err);
  }
}

/** Upload result. `url` is a short-lived presigned URL for immediate preview; `key` is the canonical persistable identifier. */
export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
}

async function presignFresh(key: string, ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS): Promise<string> {
  const config = useRuntimeConfig();
  const client = getMinioClient();
  return client.presignedGetObject(config.minioBucket, key, ttlSeconds);
}

/** Upload a file to MinIO. The bucket is private; the returned `url` is a presigned URL valid for ~15 minutes. Persist `key`, not `url`. */
export async function uploadFile(
  file: Buffer,
  originalName: string,
  contentType: string,
  folder: string = "uploads"
): Promise<UploadResult> {
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  const ext = originalName.split(".").pop() || "";
  const key = `${folder}/${randomUUID()}.${ext}`;

  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
  });

  const url = await presignFresh(key);
  return { url, key, bucket, size: file.length, contentType };
}

/** Upload Ghana Card image (per-user, per-side path). */
export async function uploadGhanaCard(
  file: Buffer,
  originalName: string,
  contentType: string,
  userId: string,
  side: "front" | "back"
): Promise<UploadResult> {
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  const ext = originalName.split(".").pop() || "jpg";
  const key = `ghana-cards/${userId}/${side}.${ext}`;

  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
  });

  const url = await presignFresh(key);
  return { url, key, bucket, size: file.length, contentType };
}

/**
 * Upload a scan of an alternate government ID (passport, voter card, etc.)
 * for applicants who legitimately can't provide a Ghana Card. The path is
 * keyed per-user + per-type so re-uploads of the same type overwrite, but
 * a different type does not clobber the previous artifact.
 */
export async function uploadAlternateIdScan(
  file: Buffer,
  originalName: string,
  contentType: string,
  userId: string,
  idType: string,
): Promise<UploadResult> {
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  const ext = originalName.split(".").pop() || "jpg";
  const safeType = idType.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const key = `alternate-ids/${userId}/${safeType}.${ext}`;

  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
  });

  const url = await presignFresh(key);
  return { url, key, bucket, size: file.length, contentType };
}

/** Upload a buffer directly to a specific key. Returns the key (persistable); re-sign with `presignStored` on read. */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  await client.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });

  return key;
}

/**
 * Turn a stored MinIO reference into a fresh short-lived presigned URL.
 *
 * Accepts three shapes:
 * - a bare bucket-relative key (the new persistable form);
 * - a legacy absolute URL `http://host:port/bucket/path` (what older rows
 *   captured before the bucket went private);
 * - an expired presigned URL (same shape plus a query string).
 *
 * For the URL forms it parses the key by stripping origin, the leading
 * bucket prefix, and any query string. Inputs that don't match either
 * shape pass through unchanged — so a corrupt row degrades to a broken
 * preview rather than a 500.
 */
export async function presignStored(
  stored: string | null | undefined,
  ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS,
): Promise<string | null> {
  if (!stored) return null;
  const key = parseStoredKey(stored);
  if (key === null) return stored;
  return presignFresh(key, ttlSeconds);
}

/** Exported for unit testing — returns the key or null when the input isn't recognizable. */
export function parseStoredKey(stored: string): string | null {
  if (!stored) return null;
  // Bare key — already in canonical form.
  if (!stored.includes("://")) return stored;
  // Absolute URL (possibly with a presign query string).
  try {
    const url = new URL(stored);
    const path = url.pathname.replace(/^\/+/, "");
    const config = useRuntimeConfig();
    const bucketPrefix = `${config.minioBucket}/`;
    if (path.startsWith(bucketPrefix)) {
      const key = path.slice(bucketPrefix.length);
      return key || null;
    }
    // Different bucket name in the URL (e.g. legacy data from a renamed
    // bucket) — fall through and just use the path as-is; better than
    // erroring out.
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Delete a file from MinIO
 */
export async function deleteFile(key: string): Promise<void> {
  const config = useRuntimeConfig();
  const client = getMinioClient();
  await client.removeObject(config.minioBucket, key);
}

/**
 * Get a presigned URL for downloading
 */
export async function getPresignedUrl(
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  const config = useRuntimeConfig();
  const client = getMinioClient();
  return client.presignedGetObject(config.minioBucket, key, expirySeconds);
}

/**
 * Trusted content type for an upload — one we can serve safely with the
 * matching response header.
 */
export type SupportedUploadType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/**
 * Inspect the first bytes of a file and return the content-type implied by
 * its signature, or `null` when the file isn't one of the supported formats.
 *
 * Used to reject the H-4 polyglot attack: a payload labelled `image/jpeg`
 * that actually carries HTML or SVG (which a browser could execute if it
 * ever sniffs the response). We trust the bytes, not the client's claim.
 *
 * Anything starting with `<` is treated as text-shaped (HTML / SVG / XML)
 * and rejected explicitly, so a renamed `.html` can't slip through under a
 * future "unknown format" allowance.
 */
export function detectMagicType(buffer: Buffer): SupportedUploadType | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF"...."WEBP"
  if (
    buffer.length >= 12
    && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF: "%PDF-"
  if (
    buffer.length >= 5
    && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
    && buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // Explicit reject for anything text-shaped (HTML / SVG / XML), so a
  // future allowance for "unknown bytes" can't accidentally let these
  // through. Leading whitespace is permitted before the `<` because
  // browsers tolerate it when MIME-sniffing.
  let i = 0;
  while (i < buffer.length && i < 32 && (buffer[i] === 0x20 || buffer[i] === 0x09 || buffer[i] === 0x0a || buffer[i] === 0x0d)) {
    i++;
  }
  if (i < buffer.length && buffer[i] === 0x3c /* '<' */) return null;

  return null;
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const IMAGE_ALLOWED = new Set<SupportedUploadType>(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_ALLOWED = new Set<SupportedUploadType>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  /** Trusted content-type derived from the file's bytes. Use this when
   * writing to MinIO so the served object can't be replayed with a
   * client-chosen Content-Type (e.g. `text/html`). */
  contentType?: SupportedUploadType;
}

function validateAgainstAllowList(
  file: Buffer,
  declaredType: string,
  allowed: Set<SupportedUploadType>,
  maxBytes: number,
  fileKindLabel: string,
): FileValidationResult {
  if (!allowed.has(declaredType as SupportedUploadType)) {
    return { valid: false, error: `Invalid file type. Allowed: ${[...allowed].join(", ")}.` };
  }
  if (file.length > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
    };
  }
  const sniffed = detectMagicType(file);
  if (sniffed === null) {
    return {
      valid: false,
      error: `File contents don't look like a supported ${fileKindLabel}.`,
    };
  }
  if (sniffed !== declaredType) {
    return {
      valid: false,
      error: "File contents don't match the declared type.",
    };
  }
  return { valid: true, contentType: sniffed };
}

/**
 * Validate an image upload. Sniffs magic bytes; rejects when the file's
 * actual content doesn't match the declared type. Returns the trusted
 * content-type the caller should use when storing the object — bypassing
 * the client-supplied value entirely.
 */
export function validateImageFile(file: Buffer, declaredType: string): FileValidationResult {
  return validateAgainstAllowList(file, declaredType, IMAGE_ALLOWED, IMAGE_MAX_BYTES, "image");
}

/**
 * Validate a document upload (PDF or image). Same magic-byte contract as
 * `validateImageFile` with the wider allow list and a 10 MB cap.
 */
export function validateDocumentFile(file: Buffer, declaredType: string): FileValidationResult {
  return validateAgainstAllowList(
    file,
    declaredType,
    DOCUMENT_ALLOWED,
    DOCUMENT_MAX_BYTES,
    "image or PDF",
  );
}
