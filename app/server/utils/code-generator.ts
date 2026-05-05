import { randomBytes } from "crypto";

/**
 * Generate a unique code for declarations
 * Format: ADLA-YYYYMMDD-XXXXX (e.g., ADLA-20241215-A3F7K)
 */
export function generateUniqueCode(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Generate 5 random alphanumeric characters
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars like 0, O, 1, I
  let randomPart = "";
  const randomBuffer = randomBytes(5);
  for (let i = 0; i < 5; i++) {
    randomPart += chars[randomBuffer[i]! % chars.length];
  }

  return `ADLA-${dateStr}-${randomPart}`;
}

/**
 * Generate a receipt number
 * Format: RCP-YYYYMMDD-NNNNNN (e.g., RCP-20241215-000001)
 */
export function generateReceiptNumber(sequence: number): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  const seqStr = String(sequence).padStart(6, "0");

  return `RCP-${dateStr}-${seqStr}`;
}

/**
 * Generate a password reset token
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a verification token
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}
