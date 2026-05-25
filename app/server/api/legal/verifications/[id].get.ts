import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");

  const profile = await prisma.applicantProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      offices: {
        include: {
          institution: true,
          officeCategory: true,
        },
        orderBy: { startDate: "desc" as const },
      },
      verificationReviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { email: true } },
        },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Applicant profile not found",
    });
  }

  // Cross-check the applicant's identity document against every other
  // applicant profile. For Ghana Card profiles we match on the unique
  // card number; for alternate-ID profiles we match on (idType, number)
  // so a passport number can't collide with a coincidental voter ID.
  // The DB enforces uniqueness; surfacing the check anyway gives
  // reviewers explicit confirmation and protects against drift.
  const isGhanaCard = profile.idType === "GHANA_CARD";
  const normalizedNumber = (
    isGhanaCard ? profile.ghanaCardNumber : profile.alternateIdNumber
  )?.trim().toUpperCase() ?? "";

  const matches = normalizedNumber
    ? await prisma.applicantProfile.findMany({
      where: {
        ...(isGhanaCard
          ? { ghanaCardNumber: normalizedNumber }
          : { idType: profile.idType, alternateIdNumber: normalizedNumber }),
        NOT: { id: profile.id },
      },
      select: {
        id: true,
        fullName: true,
        idType: true,
        ghanaCardNumber: true,
        alternateIdNumber: true,
        verificationStatus: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    })
    : [];

  return {
    success: true,
    data: {
      ...profile,
      idCheck: {
        idType: profile.idType,
        number: normalizedNumber,
        unique: matches.length === 0,
        checkedAt: new Date().toISOString(),
        matches,
      },
    },
  };
});
