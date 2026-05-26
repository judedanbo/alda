/**
 * BullMQ-backed audit-log dispatch (M-10).
 *
 * `createAuditLog` (server/utils/audit.ts) used to write the AuditLog row
 * synchronously inside the request handler and swallow any Prisma failure
 * with console.error. That's a silent-drop hazard for a compliance trail.
 *
 * When the queue is enabled, the handler enqueues a job carrying the
 * already-prepared payload (IP / UA / sessionId extracted; oldValues +
 * newValues scrubbed for PII). The worker started by
 * `server/plugins/audit-worker.ts` drains the queue with retries and
 * exponential backoff; after `maxAttempts` the job lands in BullMQ's
 * `failed` set (7-day / 5000-entry retention) which an operator can
 * inspect to recover or diagnose the drop.
 *
 * Mirrors `server/utils/notification-queue.ts` deliberately so the two
 * pipelines share idioms (lazy-singleton queue, per-pipeline IORedis,
 * exported processor for unit-testing, plugin-driven worker startup).
 */
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import prisma from "~/server/utils/prisma";

// BullMQ disallows `:` in queue names because Redis uses it as a key separator.
export const AUDIT_QUEUE_NAME = "audit-logs";

export interface AuditJobData {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Already scrubbed of PII by scrubAuditValues at enqueue time. */
  oldValues?: Record<string, unknown>;
  /** Already scrubbed of PII by scrubAuditValues at enqueue time. */
  newValues?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  /**
   * ISO timestamp captured at request time. The worker passes this as
   * `createdAt` on the Prisma create so audit rows always reflect the
   * actual event, never the worker's wall clock at write time.
   */
  occurredAt: string;
}

interface AuditConfig {
  queueEnabled: boolean;
  workerEnabled: boolean;
  workerConcurrency: number;
  maxAttempts: number;
}

let cachedConfig: AuditConfig | null = null;
function getConfig(): AuditConfig {
  if (cachedConfig) return cachedConfig;
  const cfg = useRuntimeConfig() as unknown as { audit?: Partial<AuditConfig> };
  cachedConfig = {
    queueEnabled: cfg.audit?.queueEnabled ?? false,
    workerEnabled: cfg.audit?.workerEnabled ?? true,
    workerConcurrency: cfg.audit?.workerConcurrency ?? 2,
    maxAttempts: cfg.audit?.maxAttempts ?? 3,
  };
  return cachedConfig;
}

export function isAuditQueueEnabled(): boolean {
  return getConfig().queueEnabled;
}

let connection: IORedis | null = null;
function getConnection(): IORedis {
  if (connection) return connection;
  const cfg = useRuntimeConfig() as unknown as { redisUrl?: string };
  connection = new IORedis(cfg.redisUrl ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required by BullMQ workers
    enableReadyCheck: false,
  });
  return connection;
}

let auditQueue: Queue<AuditJobData> | null = null;
export function getAuditQueue(): Queue<AuditJobData> {
  if (!auditQueue) {
    auditQueue = new Queue<AuditJobData>(AUDIT_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return auditQueue;
}

function defaultJobOptions() {
  return {
    attempts: getConfig().maxAttempts,
    // Audit writes are local-DB inserts, so the per-attempt SLA can be
    // much tighter than notifications (which talk to third parties).
    backoff: { type: "exponential" as const, delay: 5_000 },
    removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
    removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
  };
}

/**
 * Enqueue one audit-log job. No `jobId` because audit events are
 * inherently unique — there's no natural dedupe key.
 */
export async function enqueueAuditJob(data: AuditJobData): Promise<void> {
  await getAuditQueue().add("audit", data);
}

/**
 * Process one audit-log job. Called by the BullMQ worker; throws on
 * Prisma failure so BullMQ retries with the configured backoff. Exported
 * so server/utils/audit.ts can call it directly on the inline-fallback
 * path AND so unit tests can exercise it without Redis.
 */
export async function processAuditJob(job: Pick<Job<AuditJobData>, "data">): Promise<void> {
  const d = job.data;
  await prisma.auditLog.create({
    data: {
      userId: d.userId,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      // Cast through unknown because Prisma's InputJsonValue rejects
      // `undefined` but happily accepts `null` / object / primitive.
      oldValues: (d.oldValues ?? null) as never,
      newValues: (d.newValues ?? null) as never,
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
      sessionId: d.sessionId,
      // Override Prisma's @default(now()) so the row reflects the
      // request time, not the worker's wall clock at write time.
      createdAt: new Date(d.occurredAt),
    },
  });
}

/**
 * Start the BullMQ worker for the audit-logs queue. Called by the Nitro
 * plugin. Returns the worker instance so the plugin can close it on
 * shutdown.
 */
export function startAuditWorker(): Worker<AuditJobData> {
  const cfg = getConfig();
  const worker = new Worker<AuditJobData>(AUDIT_QUEUE_NAME, processAuditJob, {
    connection: getConnection(),
    concurrency: cfg.workerConcurrency,
  });

  worker.on("failed", (job, err) => {
    // Surfaced into operator logs; the job stays in BullMQ's `failed`
    // set for 7 days so it can be inspected and replayed.
    console.error(`[audit-worker] job ${job?.id} failed`, {
      attempt: job?.attemptsMade,
      action: job?.data.action,
      error: err.message,
    });
  });

  return worker;
}

/**
 * Close the queue and connection. Used in graceful shutdown and in
 * test teardown.
 */
export async function closeAuditQueue(): Promise<void> {
  await Promise.allSettled([auditQueue?.close()]);
  auditQueue = null;
  if (connection) {
    await connection.quit().catch(() => connection?.disconnect());
    connection = null;
  }
  cachedConfig = null;
}
