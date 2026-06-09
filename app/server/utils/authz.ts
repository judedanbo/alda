import type { H3Event } from "h3";
import type { JwtPayload } from "./jwt";

/**
 * Defense-in-depth role assertion for route handlers.
 *
 * The `/api/admin`, `/api/officer`, and `/api/legal` prefixes are already
 * role-gated in `server/middleware/auth.ts`. This helper re-checks the role
 * at the handler level so a future regression in the middleware (a renamed
 * prefix, a reordering, an accidental allow-list entry) can't silently expose
 * an endpoint. It also narrows `event.context.auth` to a non-null type for the
 * handler body.
 *
 * `admin` always passes — admins bypass scoped role checks everywhere else in
 * the app (see `officer-scope.ts`), so the same rule applies here.
 */
export function requireRoles(event: H3Event, roles: string[]): JwtPayload {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const allowed = new Set([...roles, "admin"]);
  if (!auth.roles?.some((r: string) => allowed.has(r))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: `Requires one of: ${[...allowed].join(", ")}`,
    });
  }
  return auth;
}
