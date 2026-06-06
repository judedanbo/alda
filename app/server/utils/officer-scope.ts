/**
 * Per-collection-office scoping for schedule-officer actions. H-3 in
 * docs/security-assessment.md.
 *
 * The `/api/officer` and post-collection write endpoints (form-collections,
 * form-returns, reviews, receipts) only enforce role membership today. That
 * lets an officer at office A act on a declaration whose form was collected
 * at office B. These two helpers add the missing check:
 *
 * - `assertOfficerCanActOnOffice(event, officeId)` — the body specifies the
 *   target office (form-collections, form-returns).
 * - `assertOfficerCanActOnDeclaration(event, declarationId)` — the office is
 *   derived from the declaration's most-recent `FormCollection.collection
 *   OfficeId` (reviews, receipts).
 *
 * Admins (`auth.roles` contains `"admin"`) bypass the check. Legal-unit
 * users are unaffected — legal is a national team per the workflow plan.
 *
 * The role middleware (`server/middleware/auth.ts`) blocks non-officer,
 * non-admin callers earlier; if those ever reach the helper anyway, the
 * missing-assignment branch throws 403.
 */

import type { H3Event } from "h3";
import prisma from "./prisma";

async function ensureAuth(event: H3Event): Promise<{ userId: string; roles: string[] }> {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return { userId: auth.userId, roles: auth.roles };
}

function isAdmin(roles: string[]): boolean {
  return roles.includes("admin");
}

export async function assertOfficerCanActOnOffice(
  event: H3Event,
  collectionOfficeId: string,
): Promise<void> {
  const { userId, roles } = await ensureAuth(event);
  if (isAdmin(roles)) return;

  const assignment = await prisma.userCollectionOffice.findFirst({
    where: { userId, collectionOfficeId },
    select: { userId: true },
  });
  if (!assignment) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You are not assigned to this collection office.",
    });
  }
}

export async function assertOfficerCanActOnDeclaration(
  event: H3Event,
  declarationId: string,
): Promise<void> {
  const { userId, roles } = await ensureAuth(event);
  if (isAdmin(roles)) return;

  const latestCollection = await prisma.formCollection.findFirst({
    where: { declarationId },
    orderBy: { createdAt: "desc" },
    select: { collectionOfficeId: true },
  });
  if (!latestCollection) {
    // Reviews + receipts only fire after FORM_COLLECTED in the state
    // machine, so an absent collection here is the "shouldn't happen"
    // guard rather than the common path.
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Declaration has no associated collection office.",
    });
  }

  const assignment = await prisma.userCollectionOffice.findFirst({
    where: { userId, collectionOfficeId: latestCollection.collectionOfficeId },
    select: { userId: true },
  });
  if (!assignment) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You are not assigned to the collection office that owns this declaration.",
    });
  }
}
