import type { VerificationStatus } from "@prisma/client";

/**
 * An applicant may upload or remove supporting documents only while a request
 * for more information is outstanding. Centralised so the upload and delete
 * routes can't drift from one another.
 */
export function canManageVerificationDocuments(status: VerificationStatus): boolean {
  return status === "MORE_INFO_REQUIRED";
}

/**
 * Statuses from which an applicant may resubmit their profile for review.
 */
export function canResubmitVerification(status: VerificationStatus): boolean {
  return status === "REJECTED" || status === "MORE_INFO_REQUIRED";
}
