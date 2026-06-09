import prisma from "~/server/utils/prisma";
import { getCredential } from "~/server/utils/notification-config";

/**
 * On-demand Arkesel SMS-credit probe. Admin-only.
 *
 * Calls Arkesel's v1 balance endpoint (sms.arkesel.com/sms/api) — note this is
 * a DIFFERENT base path from the v2 send endpoint used by sendViaArkesel in
 * sms.service.ts (/api/v2/sms/send). Same account + API key, two API versions;
 * do not "align" them.
 *
 * GET /api/admin/notifications/sms-balance
 */

// Remaining SMS units below which the UI shows a top-up warning.
const LOW_BALANCE_THRESHOLD = 50;

/** Shape Arkesel's v1 check-balance endpoint returns on success. */
interface ArkeselBalanceResponse {
  balance?: number | string;
  user?: string;
  country?: string;
  message?: string;
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!userRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  // Resolve the SAME effective key the sender uses (DB override → env → "").
  const apiKey = await getCredential("sms.arkesel.apiKey");
  if (!apiKey) {
    return { ok: false, configured: false };
  }

  try {
    const url =
      "https://sms.arkesel.com/sms/api?action=check-balance&api_key=" +
      encodeURIComponent(apiKey);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = (await response.json()) as ArkeselBalanceResponse;

    // Arkesel v1 may serialize the balance as a string; coerce defensively.
    const balance = typeof data.balance === "string" ? Number(data.balance) : data.balance;

    // The balance fields are only present on success; their absence (or a
    // non-2xx) means the key was rejected or the account is invalid.
    if (!response.ok || balance == null || Number.isNaN(balance)) {
      return {
        ok: false,
        configured: true,
        hint: data.message || "Arkesel rejected the balance request — check the API key.",
      };
    }

    return {
      ok: true,
      configured: true,
      balance,
      user: data.user,
      country: data.country,
      low: balance < LOW_BALANCE_THRESHOLD,
      threshold: LOW_BALANCE_THRESHOLD,
    };
  } catch (error) {
    // Transport failure or non-JSON body — distinct from a reachable-but-
    // rejected key (handled above). Log server-side, surface a 502 the UI
    // shows as a generic failure.
    console.error("Arkesel balance check failed:", error);
    throw createError({
      statusCode: 502,
      statusMessage: "Could not reach the Arkesel balance API.",
    });
  }
});
