import prisma from "~/server/utils/prisma";
import { sendEmail } from "~/server/services/email.service";

/**
 * Scheduled digest task (`notifications:digest`).
 *
 * Low-priority email notifications (catalog `emailMode: "digest"`) are not sent
 * when they fire — their `NotificationDeliveryLog` is created with status
 * `QUEUED`. This task drains that queue: it groups every queued email by user
 * and sends one summary email, so a user receives a single batched message
 * instead of many. In-app notifications are unaffected (delivered immediately).
 */

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default defineTask({
  meta: {
    name: "notifications:digest",
    description: "Send batched low-priority email notifications as one digest per user",
  },
  async run() {
    const config = useRuntimeConfig();
    if (!config.notifications?.digestEnabled) {
      return { result: "skipped: digest disabled" };
    }

    try {
      const queued = await prisma.notificationDeliveryLog.findMany({
        where: { channel: "EMAIL", status: "QUEUED" },
        include: {
          notification: {
            include: { user: { include: { applicantProfile: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (queued.length === 0) {
        return { result: "no queued items" };
      }

      // Group queued logs by recipient user.
      const byUser = new Map<string, typeof queued>();
      for (const log of queued) {
        const userId = log.notification.userId;
        const group = byUser.get(userId);
        if (group) group.push(log);
        else byUser.set(userId, [log]);
      }

      let sent = 0;
      let failed = 0;

      for (const group of byUser.values()) {
        const user = group[0]!.notification.user;
        const ids = group.map((log) => log.id);
        const name = user.applicantProfile?.fullName || user.email;

        try {
          const success = await sendEmail({
            to: user.email,
            subject: "Your ADLA Activity Summary",
            template: "notification-digest",
            data: {
              name,
              items: group.map((log) => ({
                title: log.notification.title,
                message: log.notification.message,
                createdAt: formatDate(log.notification.createdAt),
              })),
            },
          });

          await prisma.notificationDeliveryLog.updateMany({
            where: { id: { in: ids } },
            data: {
              status: success ? "DELIVERED" : "FAILED",
              sentAt: new Date(),
              deliveredAt: success ? new Date() : null,
            },
          });

          if (success) sent += 1;
          else failed += 1;
        } catch (error) {
          failed += 1;
          await prisma.notificationDeliveryLog.updateMany({
            where: { id: { in: ids } },
            data: { status: "FAILED", providerResponse: { error: String(error) } },
          });
        }
      }

      return {
        result: `digest complete (users sent: ${sent}, failed: ${failed}, items: ${queued.length})`,
      };
    } catch (error) {
      console.error("[notifications:digest] task failed:", error);
      return { result: "failed", error: String(error) };
    }
  },
});
