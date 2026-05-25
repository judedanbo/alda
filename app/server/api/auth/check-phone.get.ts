import { z } from "zod";
import { isE164Phone } from "~/server/utils/phone";

const querySchema = z.object({
  phone: z.string().min(1),
});

/**
 * Format-validation endpoint for the registration form's phone field.
 *
 * Intentionally NOT an existence oracle: any well-formed E.164 number
 * returns `available: true`. Uniqueness against existing accounts is
 * enforced at registration time by `register.post.ts`, where it costs
 * the attacker a full registration attempt (rate-limited) to learn a
 * single bit of "this phone is in use" — vs the historical version of
 * this endpoint, which returned that bit on every unauthenticated GET.
 */
export default defineEventHandler(async (event) => {
  const result = querySchema.safeParse(getQuery(event));

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation Error",
      data: result.error.flatten(),
    });
  }

  const { phone } = result.data;

  if (!isE164Phone(phone)) {
    return { success: true, data: { available: false, invalid: true } };
  }

  return {
    success: true,
    data: { available: true, invalid: false },
  };
});
