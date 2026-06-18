import prisma from "~/server/utils/prisma";
import { decryptProfileIds } from "~/server/utils/pii-encryption";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;
  const role = query.role as string | undefined;
  const status = query.status as string | undefined;

  // Honor the sort sent by useDataTable. Whitelist the columns the table marks
  // sortable so an arbitrary `sortBy` can't reach Prisma; fall back to newest.
  const SORTABLE = new Set(["email", "isActive", "lastLoginAt", "createdAt"]);
  const sortBy = SORTABLE.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy = { [sortBy]: sortDir } as Record<string, "asc" | "desc">;

  // Soft-deleted users are hidden everywhere in the admin UI.
  const where: Record<string, unknown> = { deletedAt: null };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { applicantProfile: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (role) {
    where.roles = {
      some: {
        role: { name: role },
      },
    };
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        emailVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: { role: true },
        },
        assignedOffices: {
          select: {
            collectionOffice: { select: { id: true, name: true, type: true, region: true } },
          },
        },
        applicantProfile: {
          select: {
            fullName: true,
            idType: true,
            ghanaCardNumberCipher: true,
            alternateIdNumberCipher: true,
            offices: {
              include: {
                officeCategory: true,
                institution: true,
              },
              orderBy: { startDate: "desc" as const },
            },
          },
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    success: true,
    data: {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        roles: user.roles.map((r) => r.role.name),
        collectionOffices: user.assignedOffices.map((a) => a.collectionOffice),
        // "Invitation pending" = staff account created but email not yet verified
        // via the invite link. (Applicants are never created here.)
        activated: user.emailVerified,
        profile: user.applicantProfile
          ? (() => {
              const decrypted = decryptProfileIds(user.applicantProfile);
              return {
                fullName: user.applicantProfile.fullName,
                idType: user.applicantProfile.idType,
                ghanaCardNumber: decrypted.ghanaCardNumber,
                alternateIdNumber: decrypted.alternateIdNumber,
                offices: user.applicantProfile.offices,
              };
            })()
          : null,
      })),
      total,
      limit,
      offset,
    },
  };
});
