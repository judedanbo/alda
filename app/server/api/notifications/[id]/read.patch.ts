import { markAsRead } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Notification ID is required",
    });
  }

  const success = await markAsRead(id, auth.userId);

  if (!success) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Notification not found",
    });
  }

  return {
    success: true,
    message: "Notification marked as read",
  };
});
