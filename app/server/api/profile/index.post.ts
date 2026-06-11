import { IdDocumentType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { validateBody, applicantProfileSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { notifyVerificationSubmitted } from "~/server/services/notification.service";
import { runAfterResponse } from "~/server/utils/after-response";
import { presignStored } from "~/server/services/storage.service";
import { encryptPii, hashPii, canonicalizeId, decryptProfileIds } from "~/server/utils/pii-encryption";

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
  // National-ID columns are encrypted; equality lookups use the HMAC hash.
  if (data.idType === IdDocumentType.GHANA_CARD) {
    const cardHash = hashPii(data.ghanaCardNumber);
    const existingCard = await prisma.applicantProfile.findUnique({
      where: { ghanaCardNumberHash: cardHash },
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
    const altHash = hashPii(data.alternateIdNumber);
    const existingAlt = await prisma.applicantProfile.findFirst({
      where: {
        idType: data.idType,
        alternateIdNumberHash: altHash,
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
        ghanaCardNumberCipher: encryptPii(canonicalizeId(data.ghanaCardNumber)),
        ghanaCardNumberHash: hashPii(data.ghanaCardNumber),
        ghanaCardFrontUrl: data.ghanaCardFrontUrl,
        ghanaCardBackUrl: data.ghanaCardBackUrl,
      }
      : {
        user: { connect: { id: auth.userId } },
        fullName: data.fullName,
        idType: data.idType,
        alternateIdNumberCipher: encryptPii(canonicalizeId(data.alternateIdNumber)),
        alternateIdNumberHash: hashPii(data.alternateIdNumber),
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

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.PROFILE_CREATED,
    entityType: "applicant_profile",
    entityId: profile.id,
    // Audit captures the plaintext we received (it's masked by
    // scrubAuditValues before persistence); cipher columns aren't useful
    // to a reviewer who can't decrypt them.
    newValues: {
      fullName: profile.fullName,
      idType: profile.idType,
      ghanaCardNumber: data.idType === IdDocumentType.GHANA_CARD ? data.ghanaCardNumber : null,
      alternateIdNumber: data.idType !== IdDocumentType.GHANA_CARD ? data.alternateIdNumber : null,
      alternateIdReason: profile.alternateIdReason,
    },
  });

  logAudit(event, {
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
  runAfterResponse(
    notifyVerificationSubmitted(auth.userId, data.fullName, profile.id),
    "notify:VERIFICATION_SUBMITTED",
  );

  // Re-sign the stored keys for client preview.
  const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
    presignStored(profile.ghanaCardFrontUrl),
    presignStored(profile.ghanaCardBackUrl),
    presignStored(profile.alternateIdScanUrl),
  ]);

  // Rehydrate the legacy `*Number` fields from the encrypted columns for
  // the response — clients still see the JSON shape they did before.
  const decrypted = decryptProfileIds(profile);

  return {
    success: true,
    message: "Profile created successfully",
    data: {
      ...decrypted,
      ghanaCardFrontUrl,
      ghanaCardBackUrl,
      alternateIdScanUrl,
    },
  };
});
