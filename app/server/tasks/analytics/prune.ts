import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { getAnalyticsConfig } from "~/server/utils/analytics-config";

/**
 * Scheduled pruning task (`analytics:prune`).
 *
 * Enforces the retention policy: raw `traffic_events` are deleted past
 * `retentionDays` (default 30) — this is the privacy guarantee that raw
 * per-request data is short-lived. Rollup aggregates and abuse history are
 * kept longer (`rollupRetentionDays`, default 365) so trends remain visible
 * after the raw data is gone. Expired enforcement actions are deactivated.
 */

export default defineTask({
  meta: {
    name: "analytics:prune",
    description: "Delete raw traffic events and rollups past their retention window",
  },
  async run() {
    const config = getAnalyticsConfig();
    if (!config.enabled) {
      return { result: "skipped: analytics disabled" };
    }

    const rawDays = Math.max(1, config.retentionDays);
    const rollupDays = Math.max(rawDays, config.rollupRetentionDays);

    try {
      const rawDeleted = await prisma.$executeRaw(
        Prisma.sql`DELETE FROM traffic_events WHERE occurred_at < now() - (${rawDays}::int * interval '1 day')`,
      );
      const hourlyDeleted = await prisma.$executeRaw(
        Prisma.sql`DELETE FROM traffic_rollup_hourly WHERE bucket < now() - (${rollupDays}::int * interval '1 day')`,
      );
      const dailyDeleted = await prisma.$executeRaw(
        Prisma.sql`DELETE FROM traffic_rollup_daily WHERE bucket < (now() - (${rollupDays}::int * interval '1 day'))::date`,
      );
      const abuseDeleted = await prisma.abuseEvent.deleteMany({
        where: { detectedAt: { lt: new Date(Date.now() - rollupDays * 86_400_000) } },
      });
      const fuzzingDeleted = await prisma.fuzzingAttempt.deleteMany({
        where: { detectedAt: { lt: new Date(Date.now() - rollupDays * 86_400_000) } },
      });

      // Deactivate enforcement actions whose temporary block has expired.
      const enforcementExpired = await prisma.enforcementAction.updateMany({
        where: { active: true, expiresAt: { not: null, lt: new Date() } },
        data: { active: false },
      });

      return {
        result: "prune complete",
        rawDeleted,
        hourlyDeleted,
        dailyDeleted,
        abuseDeleted: abuseDeleted.count,
        fuzzingDeleted: fuzzingDeleted.count,
        enforcementExpired: enforcementExpired.count,
      };
    } catch (error) {
      console.error("[analytics:prune] task failed:", error);
      return { result: "failed", error: String(error) };
    }
  },
});
