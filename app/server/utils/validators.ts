import type { H3Event } from "h3";
import { z } from "zod";

// Common validation patterns
const ghanaPhoneRegex = /^(\+233|0)[2-9]\d{8}$/;
const ghanaCardRegex = /^GHA-\d{9}-\d$/;

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
    .regex(ghanaPhoneRegex, "Invalid Ghana phone number format")
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
 * Applicant profile schema
 */
export const applicantProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  ghanaCardNumber: z
    .string()
    .regex(ghanaCardRegex, "Invalid Ghana Card number format (GHA-XXXXXXXXX-X)"),
  ghanaCardFrontUrl: z.string().url("Invalid Ghana Card front image URL").optional(),
  ghanaCardBackUrl: z.string().url("Invalid Ghana Card back image URL").optional(),
});

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
  letterScanUrl: z.string().url("Invalid letter scan URL").optional(),
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
export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
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
    throw createError({
      statusCode: 400,
      statusMessage: "Validation Error",
      data: result.error.flatten(),
    });
  }

  return result.data;
}
