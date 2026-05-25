import prisma from "~/server/utils/prisma";

/**
 * Scheduled pruning task (`notifications:prune`).
 *
 * Notifications grow unboundedly over time and most are short-lived
 * decorations on the dashboard. Apply two retention windows:
 *  - read notifications older than `readRetentionDays` (default 90)
 *  - unread notifications older than `unreadRetentionDays` (default 180)
 *
 * Delivery logs are cascade-deleted via the foreign key.
 *
 * Configurable via env:
 *   NOTIFICATIONS_READ_RETENTION_DAYS
 *   NOTIFICATIONS_UNREAD_RETENTION_DAYS
 */

const DEFAULT_READ_DAYS = 90;
const DEFAULT_UNREAD_DAYS = 180;

function envDays(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default defineTask({
  meta: {
    name: "notifications:prune",
    description: "Delete old read and very-old unread notifications",
  },
  async run() {
    const readDays = envDays("NOTIFICATIONS_READ_RETENTION_DAYS", DEFAULT_READ_DAYS);
    const unreadDays = envDays("NOTIFICATIONS_UNREAD_RETENTION_DAYS", DEFAULT_UNREAD_DAYS);

    const readCutoff = new Date(Date.now() - readDays * 86_400_000);
    const unreadCutoff = new Date(Date.now() - unreadDays * 86_400_000);

    try {
      const readPruned = await prisma.notification.deleteMany({
        where: {
          readAt: { not: null, lt: readCutoff },
        },
      });
      const unreadPruned = await prisma.notification.deleteMany({
        where: {
          readAt: null,
          createdAt: { lt: unreadCutoff },
        },
      });
      return {
        result: "prune complete",
        readPruned: readPruned.count,
        unreadPruned: unreadPruned.count,
        readCutoff: readCutoff.toISOString(),
        unreadCutoff: unreadCutoff.toISOString(),
      };
    } catch (error) {
      console.error("[notifications:prune] task failed:", error);
      return { result: "failed", error: String(error) };
    }
  },
});
