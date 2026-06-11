import type { H3Event } from "h3";
import { z } from "zod";
import { NotificationType, IdDocumentType, AlternateIdReason } from "@prisma/client";

// Common validation patterns
const e164PhoneRegex = /^\+[1-9]\d{6,14}$/;
const ghanaCardRegex = /^GHA-\d{9}-\d$/;

// Per-type formats for alternate identity documents. These are deliberately
// tolerant — the canonical authority is the uploaded scan + Legal Unit review.
export const ID_NUMBER_PATTERNS: Record<IdDocumentType, RegExp> = {
  GHANA_CARD: ghanaCardRegex,
  PASSPORT: /^[A-Z][0-9]{7,8}$/,
  VOTER_ID: /^\d{10}$/,
  DRIVERS_LICENSE: /^[A-Z]{2}-\d{6,8}-\d{2}$/,
  NIA_RECEIPT: /^[A-Z0-9-]{6,32}$/,
};

export const ID_NUMBER_FORMAT_HINTS: Record<IdDocumentType, string> = {
  GHANA_CARD: "GHA-XXXXXXXXX-X",
  PASSPORT: "Letter + 7 or 8 digits (e.g. G1234567)",
  VOTER_ID: "10 digits",
  DRIVERS_LICENSE: "AA-NNNNNNN-NN",
  NIA_RECEIPT: "Receipt code (6–32 alphanumeric / dashes)",
};

/**
 * User registration schema
 */
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  phone: z
    .string()
    .regex(e164PhoneRegex, "Invalid phone number — include country code, e.g. +14155551234")
    .optional(),
});

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

/**
 * Applicant profile schema — discriminated union on `idType`.
 *
 * GHANA_CARD branch keeps the historic shape; alternate-ID branches require
 * a structured justification reason plus an uploaded scan. The DB CHECK
 * constraint enforces the same shape at the storage layer, so a request
 * that slips past validation still cannot persist a half-formed profile.
 */
const fullNameSchema = z.string().min(2, "Full name must be at least 2 characters");

const ghanaCardProfileSchema = z.object({
  idType: z.literal(IdDocumentType.GHANA_CARD),
  fullName: fullNameSchema,
  ghanaCardNumber: z
    .string()
    .regex(ghanaCardRegex, "Invalid Ghana Card number format (GHA-XXXXXXXXX-X)"),
  // Now holds a MinIO bucket key (e.g. "ghana-cards/<userId>/front.jpg")
  // returned by the upload endpoint, not a parseable URL. The DB column is
  // still named *Url for backwards compatibility; the read path re-signs
  // through presignStored.
  ghanaCardFrontUrl: z.string().min(1).max(500),
  ghanaCardBackUrl: z.string().min(1).max(500).optional(),
});

const alternateIdProfileBase = z.object({
  fullName: fullNameSchema,
  alternateIdScanUrl: z.string().min(1).max(500),
  alternateIdReason: z.nativeEnum(AlternateIdReason, {
    errorMap: () => ({ message: "Please pick a reason for using an alternate ID" }),
  }),
  alternateIdDetails: z.string().max(2000).optional(),
});

const passportProfileSchema = alternateIdProfileBase.extend({
  idType: z.literal(IdDocumentType.PASSPORT),
  alternateIdNumber: z
    .string()
    .regex(ID_NUMBER_PATTERNS.PASSPORT, `Invalid passport number (${ID_NUMBER_FORMAT_HINTS.PASSPORT})`),
});

const voterIdProfileSchema = alternateIdProfileBase.extend({
  idType: z.literal(IdDocumentType.VOTER_ID),
  alternateIdNumber: z
    .string()
    .regex(ID_NUMBER_PATTERNS.VOTER_ID, `Invalid voter ID (${ID_NUMBER_FORMAT_HINTS.VOTER_ID})`),
});

const driversLicenseProfileSchema = alternateIdProfileBase.extend({
  idType: z.literal(IdDocumentType.DRIVERS_LICENSE),
  alternateIdNumber: z
    .string()
    .regex(ID_NUMBER_PATTERNS.DRIVERS_LICENSE, `Invalid driver's licence (${ID_NUMBER_FORMAT_HINTS.DRIVERS_LICENSE})`),
});

const niaReceiptProfileSchema = alternateIdProfileBase.extend({
  idType: z.literal(IdDocumentType.NIA_RECEIPT),
  alternateIdNumber: z
    .string()
    .regex(ID_NUMBER_PATTERNS.NIA_RECEIPT, `Invalid NIA receipt code (${ID_NUMBER_FORMAT_HINTS.NIA_RECEIPT})`),
});

export const applicantProfileSchema = z.discriminatedUnion("idType", [
  ghanaCardProfileSchema,
  passportProfileSchema,
  voterIdProfileSchema,
  driversLicenseProfileSchema,
  niaReceiptProfileSchema,
]);

export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;

export const officeSchema = z.object({
  designation: z.string().min(2, "Designation is required").max(255),
  officeCategoryId: z.number().int().positive("Office category is required"),
  institutionId: z.string().uuid("Invalid institution ID").optional().nullable(),
  startDate: z.coerce.date({ required_error: "Start date is required" }),
  endDate: z.coerce.date().optional().nullable(),
}).refine(
  (data) => !data.endDate || data.endDate > data.startDate,
  { message: "End date must be after start date", path: ["endDate"] }
);

/**
 * Declaration submission schema
 */
export const declarationSchema = z.object({
  applicantProfileId: z.string().uuid("Invalid applicant profile ID"),
});

/**
 * Form collection recording schema (GAS Officer records that the applicant
 * collected the physical declaration form from a collection office).
 */
export const formCollectionRecordSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  collectionOfficeId: z.string().uuid("Invalid collection office ID"),
  notes: z.string().optional(),
});

/**
 * Form return recording schema (GAS Officer records that the applicant filled
 * and returned the physical declaration form).
 */
export const formReturnRecordSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  returnOfficeId: z.string().uuid("Invalid office ID"),
  notes: z.string().optional(),
});

/**
 * Section review schemas
 */
const FORM_SECTIONS = [
  "PERSONAL_PARTICULARS",
  "PROPERTIES",
  "EMPLOYMENT_BUSINESS",
  "SECURITIES_BANK",
  "ALIASES_PROPERTIES",
  "LIABILITIES",
  "VOLUNTARY_INFO",
  "DECLARANT_CERTIFICATE",
] as const;

const sectionReviewItemSchema = z.object({
  section: z.enum(FORM_SECTIONS),
  isAcceptable: z.boolean(),
  comments: z.string().optional(),
}).refine(
  (d) => d.isAcceptable || (d.comments && d.comments.length > 0),
  { message: "Comments are required for sections marked as not acceptable", path: ["comments"] }
);

export const sectionReviewSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  sections: z.array(sectionReviewItemSchema).length(8, "All 8 form sections must be reviewed"),
});

export const approveReviewSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
});

export const rejectReviewSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  rejectionReason: z.string().min(1, "Rejection reason is required"),
  reissueCode: z.boolean().default(false),
  reissueStage: z.enum(["CODE_GENERATED", "FORM_COLLECTED"]).default("FORM_COLLECTED"),
  collectionOfficeId: z.string().uuid("Invalid collection office ID").optional(),
}).refine(
  (d) => !d.reissueCode || d.reissueStage !== "FORM_COLLECTED" || d.collectionOfficeId,
  { message: "Collection office is required when reissuing at Form Collected stage", path: ["collectionOfficeId"] },
);

/**
 * Lost-form reissue request schema (applicant)
 */
export const reissueRequestSchema = z.object({
  applicantNote: z.string().max(2000).optional(),
});

/**
 * Lost-form reissue decision schema (legal officer combined action)
 */
export const reissueDecisionSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
  // MinIO bucket key returned by /api/upload/reissue-letter — not a URL.
  letterScanUrl: z.string().min(1).max(500).optional(),
  approverType: z.enum(["AUDITOR_GENERAL", "REGIONAL_AUDITOR"]).optional(),
  approverDetail: z.string().max(255).optional(),
  decisionReason: z.string().optional(),
}).refine(
  (data) =>
    data.status !== "APPROVED" ||
    (!!data.letterScanUrl && data.letterScanUrl.length > 0 && !!data.approverType),
  {
    message: "An uploaded approval letter and the approver are required to approve a reissue",
    path: ["letterScanUrl"],
  }
).refine(
  (data) => data.status !== "DECLINED" || (!!data.decisionReason && data.decisionReason.length > 0),
  {
    message: "A reason is required when declining a reissue request",
    path: ["decisionReason"],
  }
);

/**
 * Verification review schema (legal officer decision)
 */
export const verificationReviewSchema = z.object({
  status: z.enum(["VERIFIED", "ON_HOLD", "MORE_INFO_REQUIRED", "REJECTED"]),
  reason: z.string().min(1, "Reason is required"),
  messageToApplicant: z.string().optional(),
}).refine(
  (data) => data.status !== "MORE_INFO_REQUIRED" || (data.messageToApplicant && data.messageToApplicant.length > 0),
  {
    message: "A message to the applicant is required when requesting more information",
    path: ["messageToApplicant"],
  }
);

/**
 * Notification preferences schema
 */
const channelFlagsSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
});

export const notificationPreferencesSchema = z.object({
  channels: channelFlagsSchema,
  typePreferences: z.array(
    channelFlagsSchema.extend({
      type: z.nativeEnum(NotificationType),
    }),
  ),
});

/**
 * Accessibility preferences schema (per-user UI display settings)
 */
export const accessibilityPreferencesSchema = z.object({
  textSize: z.enum(["base", "lg", "xl", "2xl"]),
  reduceMotion: z.boolean(),
  underlineLinks: z.boolean(),
  readableFont: z.boolean(),
});

/**
 * Analytics actor allow/block rule schema (admin manual enforcement)
 */
export const analyticsActorRuleSchema = z.object({
  action: z.enum(["block", "allow", "unblock"]),
  ip: z.string().trim().min(3, "IP address is required").max(64),
  reason: z.string().max(500).optional(),
  expiresInMinutes: z.number().int().positive().max(525600).optional(),
});

// L-7: admin endpoints used to readBody + type-cast manually. These
// schemas back the unified `validateBody` flow so malformed input is
// rejected at the boundary with a structured 400 instead of leaking
// through to Prisma as a 500.

export const adminUserRolesSchema = z.object({
  roleIds: z.array(z.number().int().positive()).max(20),
});

export const adminUserStatusSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Roles an admin may assign when CREATING a user. `applicant` is deliberately
 * excluded — applicants self-register; admins can only add the applicant role
 * to an EXISTING user via the roles endpoint.
 */
export const STAFF_ASSIGNABLE_ROLES = ["admin", "legal_unit", "schedule_officer"] as const;

export const adminCreateUserSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .regex(e164PhoneRegex, "Invalid phone number — include country code, e.g. +14155551234")
      .optional(),
    roleNames: z.array(z.enum(STAFF_ASSIGNABLE_ROLES)).min(1, "Select at least one role"),
    collectionOfficeIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((val, ctx) => {
    const isOfficer = val.roleNames.includes("schedule_officer");
    if (isOfficer && val.collectionOfficeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collectionOfficeIds"],
        message: "Assign at least one collection office for a schedule officer",
      });
    }
    if (!isOfficer && val.collectionOfficeIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collectionOfficeIds"],
        message: "Only schedule officers can be assigned collection offices",
      });
    }
  });

export const adminUserOfficesSchema = z.object({
  collectionOfficeIds: z.array(z.string().uuid()),
});

/**
 * Admin edit of a staff user's contact details. Both fields are optional so the
 * admin can update one without the other; at least one must be present. Phone
 * may be sent as null to clear it. Roles/offices/status have their own endpoints.
 */
export const adminUpdateUserSchema = z
  .object({
    email: z.string().email("Invalid email address").optional(),
    phone: z
      .string()
      .regex(e164PhoneRegex, "Invalid phone number — include country code, e.g. +14155551234")
      .nullable()
      .optional(),
  })
  .refine((v) => v.email !== undefined || v.phone !== undefined, {
    message: "Provide an email or phone number to update",
  });

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const adminInstitutionCreateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  type: z.string().trim().min(1).max(100).nullable().optional(),
});

export const adminInstitutionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  type: z.string().trim().min(1).max(100).nullable().optional(),
  isActive: z.boolean(),
});

/**
 * Notification credential overrides (Notifications → Settings). `set` maps a
 * registry key → new value to store (encrypted); `clear` lists keys whose DB
 * override should be removed (revert to env). Key membership and per-field
 * value rules (port numeric, provider enum) are enforced in the handler against
 * the CREDENTIAL_FIELDS registry.
 */
export const notificationCredentialsSchema = z.object({
  set: z.record(z.string(), z.string()).optional(),
  clear: z.array(z.string()).optional(),
});

/**
 * System setting overrides (Admin → Settings). `set` maps a registry key → raw
 * string value to store ("true"/"false" for booleans, the integer for
 * numbers); `clear` lists keys whose DB override should be removed (revert to
 * env). Key membership and per-field kind/range rules are enforced in the
 * handler against the SETTING_FIELDS registry.
 */
export const systemSettingsSchema = z.object({
  set: z.record(z.string(), z.string()).optional(),
  clear: z.array(z.string()).optional(),
});

/**
 * Validate request body against a schema
 */
export async function validateBody<T extends z.ZodSchema>(
  event: H3Event,
  schema: T
): Promise<z.infer<T>> {
  const body = await readBody(event);
  const result = schema.safeParse(body);

  if (!result.success) {
    const flat = result.error.flatten();
    // Stash failure metadata (field NAMES only, never submitted values) so the
    // traffic plugin can classify + record this as a FORM_VALIDATION fuzzing
    // attempt in its afterResponse hook. See server/utils/fuzzing.ts.
    event.context.fuzzing = {
      validationFailed: true,
      fields: Object.keys(flat.fieldErrors),
    };
    throw createError({
      statusCode: 400,
      statusMessage: "Validation Error",
      data: flat,
    });
  }

  return result.data;
}
