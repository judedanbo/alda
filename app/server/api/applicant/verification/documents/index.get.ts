import prisma from "~/server/utils/prisma";
import { presignStored } from "~/server/services/storage.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found. Please complete your profile first.",
    });
  }

  const documents = await prisma.verificationDocument.findMany({
    where: { applicantId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  // The bucket is private; re-sign stored keys into short-lived URLs so the
  // applicant can preview/download what they submitted.
  const data = await Promise.all(
    documents.map(async (doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      contentType: doc.contentType,
      size: doc.size,
      note: doc.note,
      createdAt: doc.createdAt,
      url: await presignStored(doc.documentKey),
    })),
  );

  return { success: true, data };
});
