import { getAuthUser, type JwtPayload } from "../utils/jwt";
import prisma from "../utils/prisma";

// Extend H3EventContext to include auth user
declare module "h3" {
  interface H3EventContext {
    auth?: JwtPayload;
  }
}

// Routes that don't require authentication
const publicRoutes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/health",
  "/api/categories",
  "/api/institutions",
  // SMS provider delivery callbacks — authenticated via a shared
  // webhook secret in the handler, not via the user JWT.
  "/api/webhooks/sms/",
  // SSE stream — authenticated via `?token=` query in the handler
  // because EventSource can't set custom headers.
  "/api/notifications/stream",
  ...(process.env.NODE_ENV !== "production" ? ["/api/dev"] : []),
];

// Routes that require specific roles
const roleProtectedRoutes: Record<string, string[]> = {
  "/api/admin": ["admin"],
  "/api/officer": ["schedule_officer", "admin"],
  "/api/legal": ["legal_unit", "admin"],
};

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Skip auth for non-API routes
  if (!path.startsWith("/api/")) {
    return;
  }

  // Skip auth for public routes
  if (publicRoutes.some((route) => path.startsWith(route))) {
    return;
  }

  // Get authenticated user
  const user = getAuthUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Authentication required",
    });
  }

  // Verify the user still exists and is active in the database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "User account not found or deactivated. Please log in again.",
    });
  }

  // Attach user to event context
  event.context.auth = user;

  // Check role-based access
  for (const [routePrefix, allowedRoles] of Object.entries(roleProtectedRoutes)) {
    if (path.startsWith(routePrefix)) {
      const hasRole = user.roles.some((role) => allowedRoles.includes(role));
      if (!hasRole) {
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden",
          message: "Insufficient permissions",
        });
      }
      break;
    }
  }
});
