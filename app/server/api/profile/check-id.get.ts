import { IdDocumentType } from "@prisma/client";
import { z } from "zod";
import prisma from "~/server/utils/prisma";
import { ID_NUMBER_PATTERNS } from "~/server/utils/validators";
import { hashPii } from "~/server/utils/pii-encryption";

const querySchema = z.object({
  idType: z.nativeEnum(IdDocumentType),
  number: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const result = querySchema.safeParse(getQuery(event));

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation Error",
      data: result.error.flatten(),
    });
  }

  const { idType } = result.data;
  const number = result.data.number.trim().toUpperCase();

  if (!ID_NUMBER_PATTERNS[idType].test(number)) {
    return { success: true, data: { available: false, invalid: true } };
  }

  // National-ID columns are encrypted; equality lookups go via the HMAC
  // hash column populated at write time.
  const hash = hashPii(number);
  const existing = await prisma.applicantProfile.findFirst({
    where: {
      ...(idType === IdDocumentType.GHANA_CARD
        ? { ghanaCardNumberHash: hash }
        : { idType, alternateIdNumberHash: hash }),
      NOT: { userId: auth.userId },
    },
    select: { id: true },
  });

  return {
    success: true,
    data: { available: !existing, invalid: false },
  };
});
