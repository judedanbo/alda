import { markAllAsRead } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const count = await markAllAsRead(auth.userId);

  return {
    success: true,
    message: `${count} notification(s) marked as read`,
    data: { count },
  };
});
