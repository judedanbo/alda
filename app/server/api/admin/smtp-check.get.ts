import prisma from "~/server/utils/prisma";
import { verifyEmailConnection, isSmtpAuthConfigured } from "~/server/services/email.service";

/**
 * On-demand SMTP health probe. Admin-only. Opens an authenticated connection
 * to the mail server WITHOUT sending any email, so it's safe to hit right
 * after a deploy to confirm SMTP_USER/SMTP_PASS actually took effect.
 *
 * GET /api/admin/smtp-check
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
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

  const config = useRuntimeConfig();
  // Safe to surface — these are non-secret connection coordinates, useful for
  // confirming the box is pointed at the right server. Never include the
  // user/pass here.
  const target = { host: config.smtpHost, port: config.smtpPort };
  const authConfigured = isSmtpAuthConfigured();

  // Short-circuit: with no credentials, verify() would fail with a confusing
  // auth error. Empty creds on a prod build almost always means the env vars
  // weren't NUXT_-prefixed, so point straight at that.
  if (!authConfigured) {
    return {
      ok: false,
      authConfigured: false,
      ...target,
      hint:
        "SMTP credentials are empty in runtimeConfig. On a production build, " +
        "set NUXT_SMTP_USER / NUXT_SMTP_PASS (plain SMTP_USER/SMTP_PASS are " +
        "only read at build time and are ignored at runtime).",
    };
  }

  try {
    await verifyEmailConnection();
    return { ok: true, authConfigured: true, ...target };
  } catch (error) {
    // nodemailer errors carry a `.code` that maps cleanly to a remediation.
    const code = (error as { code?: string }).code;
    const responseCode = (error as { responseCode?: number }).responseCode;

    const hint =
      code === "EAUTH"
        ? "Authentication rejected by the mail server. Verify SMTP_USER/SMTP_PASS " +
          "are correct and (on a prod build) NUXT_-prefixed."
        : code === "ECONNECTION" || code === "ESOCKET"
          ? `Could not establish a connection to ${target.host}:${target.port}. ` +
            "Check SMTP_HOST/SMTP_PORT and TLS (port 465 ⇒ secure, 587 ⇒ STARTTLS)."
          : code === "ETIMEDOUT"
            ? `Connection to ${target.host}:${target.port} timed out — likely ` +
              "outbound SMTP is blocked by a firewall/security group."
            : "SMTP verification failed. See server logs for the full error.";

    // Log the full error server-side; the response stays sanitized.
    console.error("SMTP check failed:", error);

    return { ok: false, authConfigured: true, ...target, code, responseCode, hint };
  }
});
