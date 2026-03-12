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
  designation: z.string().min(2, "Designation is required"),
  institutionId: z.string().uuid("Invalid institution ID").optional().nullable(),
  officeCategoryId: z.number().int().positive("Office category is required"),
});

/**
 * Declaration submission schema
 */
export const declarationSchema = z.object({
  applicantProfileId: z.string().uuid("Invalid applicant profile ID"),
});

/**
 * Submission recording schema (GAS Officer)
 */
export const submissionRecordSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  notes: z.string().optional(),
});

/**
 * Review schema
 */
export const reviewSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
}).refine(
  (data) => data.status !== "REJECTED" || (data.rejectionReason && data.rejectionReason.length > 0),
  {
    message: "Rejection reason is required when rejecting a declaration",
    path: ["rejectionReason"],
  }
);

/**
 * Pickup authorization schema
 */
export const pickupAuthorizationSchema = z.object({
  declarationId: z.string().uuid("Invalid declaration ID"),
  isSelfPickup: z.boolean(),
  authorizedName: z.string().optional(),
  authorizedPhone: z.string().regex(ghanaPhoneRegex, "Invalid phone number").optional(),
}).refine(
  (data) => data.isSelfPickup || (data.authorizedName && data.authorizedPhone),
  {
    message: "Authorized person details are required for third-party pickup",
    path: ["authorizedName"],
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

// Re-export H3Event type for use in validators
import type { H3Event } from "h3";
