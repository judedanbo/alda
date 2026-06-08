/**
 * BullMQ-backed notification dispatch.
 *
 * The notification service writes the `Notification` row and a PENDING
 * `NotificationDeliveryLog` row synchronously, then asks this module to
 * dispatch the actual provider call. When the queue is enabled, dispatch
 * enqueues a BullMQ job that the worker (started by
 * `server/plugins/notification-worker.ts`) drains with retries. When the
 * queue is disabled (no REDIS_URL, or tests, or operator override) the
 * caller falls back to inline send.
 *
 * The processor functions (`processEmailJob`, `processSmsJob`) are
 * exported so the worker plugin can register them, and so they can be
 * unit-tested without spinning up Redis.
 */
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import prisma from "~/server/utils/prisma";
import { sendEmail, type EmailTemplate } from "~/server/services/email.service";
import { sendSms } from "~/server/services/sms.service";

// BullMQ disallows `:` in queue names because Redis uses it as a key separator.
export const EMAIL_QUEUE_NAME = "notifications-email";
export const SMS_QUEUE_NAME = "notifications-sms";

export interface EmailJobData {
  deliveryLogId: string;
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export interface SmsJobData {
  deliveryLogId: string;
  to: string;
  message: string;
}

interface NotificationsConfig {
  queueEnabled: boolean;
  workerEnabled: boolean;
  emailConcurrency: number;
  smsConcurrency: number;
  maxAttempts: number;
}

let cachedConfig: NotificationsConfig | null = null;
function getConfig(): NotificationsConfig {
  if (cachedConfig) return cachedConfig;
  const cfg = useRuntimeConfig() as unknown as { notifications?: Partial<NotificationsConfig> };
  cachedConfig = {
    queueEnabled: cfg.notifications?.queueEnabled ?? false,
    workerEnabled: cfg.notifications?.workerEnabled ?? true,
    emailConcurrency: cfg.notifications?.emailConcurrency ?? 5,
    smsConcurrency: cfg.notifications?.smsConcurrency ?? 5,
    maxAttempts: cfg.notifications?.maxAttempts ?? 3,
  };
  return cachedConfig;
}

export function isQueueEnabled(): boolean {
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

let emailQueue: Queue<EmailJobData> | null = null;
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return emailQueue;
}

let smsQueue: Queue<SmsJobData> | null = null;
export function getSmsQueue(): Queue<SmsJobData> {
  if (!smsQueue) {
    smsQueue = new Queue<SmsJobData>(SMS_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return smsQueue;
}

function defaultJobOptions() {
  return {
    attempts: getConfig().maxAttempts,
    backoff: { type: "exponential" as const, delay: 30_000 },
    removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
    removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
  };
}

/**
 * Enqueue an email job. Job ID = deliveryLogId so BullMQ naturally
 * dedupes accidental double-enqueues.
 */
export async function enqueueEmailJob(data: EmailJobData): Promise<void> {
  await getEmailQueue().add("email", data, { jobId: data.deliveryLogId });
}

export async function enqueueSmsJob(data: SmsJobData): Promise<void> {
  await getSmsQueue().add("sms", data, { jobId: data.deliveryLogId });
}

/**
 * Re-enqueue a job for a delivery log that already ran (admin retry).
 *
 * Jobs are keyed by `deliveryLogId`, and a previously-failed job lingers in
 * BullMQ's `failed` set for 7 days — `add()` with the same jobId would be
 * rejected as a duplicate and silently no-op. So we remove any existing job
 * with that id first (best-effort), then add a fresh one that re-enters the
 * normal retry/backoff pipeline.
 */
export async function reenqueueEmailJob(data: EmailJobData): Promise<void> {
  await getEmailQueue().remove(data.deliveryLogId).catch(() => {});
  await enqueueEmailJob(data);
}

export async function reenqueueSmsJob(data: SmsJobData): Promise<void> {
  await getSmsQueue().remove(data.deliveryLogId).catch(() => {});
  await enqueueSmsJob(data);
}

/**
 * Process an email job. Called by the BullMQ worker; throws on send
 * failure so BullMQ retries with the configured backoff.
 *
 * Updates the corresponding NotificationDeliveryLog with the outcome of
 * each attempt; retryCount tracks the number of attempts made so far.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { deliveryLogId, to, subject, template, data } = job.data;
  let success = false;
  let errorMessage: string | undefined;
  try {
    success = await sendEmail({ to, subject, template, data });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await prisma.notificationDeliveryLog.update({
    where: { id: deliveryLogId },
    data: {
      status: success ? "DELIVERED" : "FAILED",
      sentAt: new Date(),
      deliveredAt: success ? new Date() : null,
      retryCount: job.attemptsMade,
      providerResponse: success ? undefined : { error: errorMessage ?? "send returned false" },
    },
  });

  if (!success) {
    throw new Error(errorMessage ?? "email send returned false");
  }
}

/**
 * Process an SMS job. Mirrors processEmailJob.
 */
export async function processSmsJob(job: Job<SmsJobData>): Promise<void> {
  const { deliveryLogId, to, message } = job.data;
  let result: Awaited<ReturnType<typeof sendSms>>;
  try {
    result = await sendSms(to, message);
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  await prisma.notificationDeliveryLog.update({
    where: { id: deliveryLogId },
    data: {
      status: result.success ? "DELIVERED" : "FAILED",
      sentAt: new Date(),
      deliveredAt: result.success ? new Date() : null,
      retryCount: job.attemptsMade,
      providerResponse: result.success
        ? { messageId: result.messageId, provider: result.provider }
        : { error: result.error },
    },
  });

  if (!result.success) {
    throw new Error(result.error ?? "sms send failed");
  }
}

/**
 * Start BullMQ workers for the email and sms queues. Called by the
 * Nitro plugin. Returns the worker instances so the plugin can close
 * them on shutdown.
 */
export function startNotificationWorkers(): { email: Worker; sms: Worker } {
  const cfg = getConfig();
  const email = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getConnection(),
    concurrency: cfg.emailConcurrency,
  });
  const sms = new Worker<SmsJobData>(SMS_QUEUE_NAME, processSmsJob, {
    connection: getConnection(),
    concurrency: cfg.smsConcurrency,
  });

  for (const w of [email, sms]) {
    w.on("failed", (job, err) => {
      console.error(`[notification-worker] ${w.name} job ${job?.id} failed`, {
        attempt: job?.attemptsMade,
        error: err.message,
      });
    });
  }

  return { email, sms };
}

/**
 * Close all queue and connection resources. Used in graceful shutdown
 * and in test teardown.
 */
export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    emailQueue?.close(),
    smsQueue?.close(),
  ]);
  emailQueue = null;
  smsQueue = null;
  if (connection) {
    await connection.quit().catch(() => connection?.disconnect());
    connection = null;
  }
  cachedConfig = null;
}
