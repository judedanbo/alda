import { IdDocumentType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { validateBody, applicantProfileSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyVerificationSubmitted } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const existingProfile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "Profile already exists. Use PUT to update.",
    });
  }

  const data = await validateBody(event, applicantProfileSchema);

  // Per-path uniqueness check. DB constraints catch races, but a friendly
  // 409 with field-scoped error is far better than a raw constraint failure.
  if (data.idType === IdDocumentType.GHANA_CARD) {
    const existingCard = await prisma.applicantProfile.findUnique({
      where: { ghanaCardNumber: data.ghanaCardNumber },
    });
    if (existingCard) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        data: {
          fieldErrors: { ghanaCardNumber: ["A profile with this Ghana Card number already exists"] },
          formErrors: [],
        },
      });
    }
  } else {
    const existingAlt = await prisma.applicantProfile.findFirst({
      where: {
        idType: data.idType,
        alternateIdNumber: data.alternateIdNumber,
      },
    });
    if (existingAlt) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        data: {
          fieldErrors: { alternateIdNumber: ["A profile with this ID number already exists"] },
          formErrors: [],
        },
      });
    }
  }

  const createData: Prisma.ApplicantProfileCreateInput =
    data.idType === IdDocumentType.GHANA_CARD
      ? {
        user: { connect: { id: auth.userId } },
        fullName: data.fullName,
        idType: data.idType,
        ghanaCardNumber: data.ghanaCardNumber,
        ghanaCardFrontUrl: data.ghanaCardFrontUrl,
        ghanaCardBackUrl: data.ghanaCardBackUrl,
      }
      : {
        user: { connect: { id: auth.userId } },
        fullName: data.fullName,
        idType: data.idType,
        alternateIdNumber: data.alternateIdNumber,
        alternateIdScanUrl: data.alternateIdScanUrl,
        alternateIdReason: data.alternateIdReason,
        alternateIdDetails: data.alternateIdDetails,
      };

  const profile = await prisma.applicantProfile.create({
    data: createData,
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
    action: AuditActions.PROFILE_CREATED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: {
      fullName: profile.fullName,
      idType: profile.idType,
      ghanaCardNumber: profile.ghanaCardNumber,
      alternateIdNumber: profile.alternateIdNumber,
      alternateIdReason: profile.alternateIdReason,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_REQUESTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: {
      verificationStatus: "PENDING_VERIFICATION",
    },
  });

  // Notify applicant that verification is in progress. profile.id is
  // a natural per-profile key — re-clicks dedupe; a future resubmit
  // uses a different key (see resubmit endpoint).
  await notifyVerificationSubmitted(auth.userId, data.fullName, profile.id);

  return {
    success: true,
    message: "Profile created successfully",
    data: profile,
  };
});
