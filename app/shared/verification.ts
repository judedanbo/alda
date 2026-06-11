/**
 * Verification-document constants and types shared between the Nitro server
 * routes and the client. Imported explicitly from both sides via
 * `~/shared/verification` so the limit and the shape can never drift.
 */

/** Maximum supporting documents an applicant may attach to an info request. */
export const MAX_VERIFICATION_DOCUMENTS = 10;

/** Maximum length of the optional per-document note. */
export const MAX_VERIFICATION_DOCUMENT_NOTE_LENGTH = 1000;

/** A document as returned to the client (re-signed URL, serialized dates). */
export interface VerificationDocument {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  note: string | null;
  createdAt: string;
  url: string;
}
