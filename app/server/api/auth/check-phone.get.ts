import { z } from "zod";
import prisma from "~/server/utils/prisma";
import {
  ghanaPhoneAlternates,
  isE164Phone,
  isGhanaPhone,
  normalizePhoneE164,
} from "~/server/utils/phone";

const querySchema = z.object({
  phone: z.string().min(1),
});

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

  // For Ghana numbers we look up both the canonical (+233…) and legacy
  // local (0…) representations to catch pre-normalization rows. For any
  // other country code, E.164 is the single canonical form we store.
  const canonical = normalizePhoneE164(phone)!;
  const candidates = isGhanaPhone(canonical)
    ? ghanaPhoneAlternates(canonical)
    : [canonical];

  const existing = await prisma.user.findFirst({
    where: { phone: { in: candidates } },
    select: { id: true },
  });

  return {
    success: true,
    data: { available: !existing, invalid: false },
  };
});
