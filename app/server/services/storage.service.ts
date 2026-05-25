import { Client } from "minio";
import { randomUUID } from "crypto";

let minioClient: Client | null = null;

/**
 * Get or create MinIO client
 */
function getMinioClient(): Client {
  if (!minioClient) {
    const config = useRuntimeConfig();
    minioClient = new Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      useSSL: false,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
    });
  }
  return minioClient;
}

/**
 * Ensure bucket exists
 */
async function ensureBucket(bucketName: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName);
  }
}

/**
 * Upload file result
 */
export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
}

/**
 * Upload a file to MinIO
 */
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

  // Generate unique filename
  const ext = originalName.split(".").pop() || "";
  const key = `${folder}/${randomUUID()}.${ext}`;

  // Upload file
  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
    "x-amz-acl": "public-read",
  });

  // Generate URL
  const url = `http://${config.minioEndpoint}:${config.minioPort}/${bucket}/${key}`;

  return {
    url,
    key,
    bucket,
    size: file.length,
    contentType,
  };
}

/**
 * Upload Ghana Card image
 */
export async function uploadGhanaCard(
  file: Buffer,
  originalName: string,
  contentType: string,
  userId: string,
  side: "front" | "back"
): Promise<UploadResult> {
  const folder = `ghana-cards/${userId}`;
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  // Generate filename
  const ext = originalName.split(".").pop() || "jpg";
  const key = `${folder}/${side}.${ext}`;

  // Upload file
  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
  });

  // Generate URL
  const url = `http://${config.minioEndpoint}:${config.minioPort}/${bucket}/${key}`;

  return {
    url,
    key,
    bucket,
    size: file.length,
    contentType,
  };
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
  const folder = `alternate-ids/${userId}`;
  const config = useRuntimeConfig();
  const bucket = config.minioBucket;
  const client = getMinioClient();

  await ensureBucket(bucket);

  const ext = originalName.split(".").pop() || "jpg";
  const safeType = idType.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const key = `${folder}/${safeType}.${ext}`;

  await client.putObject(bucket, key, file, file.length, {
    "Content-Type": contentType,
  });

  const url = `http://${config.minioEndpoint}:${config.minioPort}/${bucket}/${key}`;

  return {
    url,
    key,
    bucket,
    size: file.length,
    contentType,
  };
}

/**
 * Upload a buffer directly with a specific path
 */
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

  return `http://${config.minioEndpoint}:${config.minioPort}/${bucket}/${key}`;
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
 * Validate image file
 */
export function validateImageFile(
  contentType: string,
  size: number
): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: "File too large. Maximum size is 5MB.",
    };
  }

  return { valid: true };
}

/**
 * Validate document file (scanned letters: PDF or image)
 */
export function validateDocumentFile(
  contentType: string,
  size: number
): { valid: boolean; error?: string } {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: "Invalid file type. Only PDF, JPEG, PNG, and WebP files are allowed.",
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: "File too large. Maximum size is 10MB.",
    };
  }

  return { valid: true };
}
