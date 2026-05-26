import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { presignStored } from "~/server/services/storage.service";
import { z } from "zod";

// Fields hold MinIO bucket keys (e.g. "ghana-cards/<userId>/front.jpg"),
// not URLs; the bucket is private and reads re-sign via `presignStored`.
const updateProfileSchema = z.object({
  ghanaCardFrontUrl: z.string().min(1).max(500).optional(),
  ghanaCardBackUrl: z.string().min(1).max(500).optional(),
  alternateIdScanUrl: z.string().min(1).max(500).optional(),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profile not found. Please complete profile setup first.",
    });
  }

  const body = await readBody(event);
  const result = updateProfileSchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0]?.message || "Invalid data",
    });
  }

  const oldValues = {
    ghanaCardFrontUrl: profile.ghanaCardFrontUrl,
    ghanaCardBackUrl: profile.ghanaCardBackUrl,
    alternateIdScanUrl: profile.alternateIdScanUrl,
  };

  const updated = await prisma.applicantProfile.update({
    where: { userId: auth.userId },
    data: result.data,
    include: {
      offices: {
        include: {
          officeCategory: true,
          institution: true,
        },
      },
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.PROFILE_UPDATED,
    entityType: "applicant_profile",
    entityId: updated.id,
    oldValues,
    newValues: result.data,
  });

  // Re-sign the stored keys into short-lived URLs for client preview.
  const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
    presignStored(updated.ghanaCardFrontUrl),
    presignStored(updated.ghanaCardBackUrl),
    presignStored(updated.alternateIdScanUrl),
  ]);

  return {
    success: true,
    message: "Profile updated successfully",
    data: {
      ...updated,
      ghanaCardFrontUrl,
      ghanaCardBackUrl,
      alternateIdScanUrl,
    },
  };
});
