import { getUserNotifications } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const query = getQuery(event);
  const limit = parseInt(query.limit as string) || 20;
  const offset = parseInt(query.offset as string) || 0;
  const unreadOnly = query.unreadOnly === "true";

  const result = await getUserNotifications(auth.userId, {
    limit,
    offset,
    unreadOnly,
  });

  return {
    success: true,
    data: result,
  };
});
