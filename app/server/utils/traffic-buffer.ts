import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

/**
 * Async, batched writer for traffic events.
 *
 * Events are appended to an in-memory buffer and flushed to Postgres either
 * when the batch fills or on a timer. Capture must never fail or slow a user
 * request, so: every operation is wrapped in try/catch, the buffer is hard
 * capped (oldest events dropped under sustained DB outage), and flushing is
 * fire-and-forget — callers never await it.
 */

export type TrafficEventInput = Prisma.TrafficEventCreateManyInput;

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BUFFER = 5_000;

interface BufferGlobal {
  buffer: TrafficEventInput[];
  timer: NodeJS.Timeout | null;
  dropped: number;
  flushing: boolean;
}

// Survive dev HMR re-imports the same way the Prisma singleton does.
const g = globalThis as typeof globalThis & { __trafficBuffer?: BufferGlobal };
const state: BufferGlobal = g.__trafficBuffer ?? {
  buffer: [],
  timer: null,
  dropped: 0,
  flushing: false,
};
if (process.env.NODE_ENV !== "production") g.__trafficBuffer = state;

/** Queues a traffic event for asynchronous batched insertion. Never throws. */
export function enqueueTrafficEvent(eventInput: TrafficEventInput): void {
  try {
    if (state.buffer.length >= MAX_BUFFER) {
      // Sustained DB outage: shed load rather than grow memory unbounded.
      state.buffer.shift();
      state.dropped++;
    }
    state.buffer.push(eventInput);
    if (state.buffer.length >= BATCH_SIZE) {
      void flushTrafficEvents();
    }
  } catch (error) {
    console.error("[traffic-buffer] enqueue failed:", error);
  }
}

/** Flushes all buffered events to the database in one batch. Never throws. */
export async function flushTrafficEvents(): Promise<number> {
  if (state.flushing || state.buffer.length === 0) return 0;
  state.flushing = true;
  const batch = state.buffer.splice(0, state.buffer.length);
  try {
    await prisma.trafficEvent.createMany({ data: batch });
    if (state.dropped > 0) {
      console.warn(`[traffic-buffer] dropped ${state.dropped} events during DB pressure`);
      state.dropped = 0;
    }
    return batch.length;
  } catch (error) {
    console.error(`[traffic-buffer] flush of ${batch.length} events failed:`, error);
    // Re-queue (bounded) so a transient failure doesn't lose data outright.
    if (state.buffer.length + batch.length <= MAX_BUFFER) {
      state.buffer.unshift(...batch);
    }
    return 0;
  } finally {
    state.flushing = false;
  }
}

/** Starts the periodic flush timer (idempotent across HMR reloads). */
export function startTrafficBufferTimer(): void {
  if (state.timer) return;
  state.timer = setInterval(() => {
    void flushTrafficEvents();
  }, FLUSH_INTERVAL_MS);
  // Do not keep the event loop alive solely for analytics flushing.
  state.timer.unref?.();
}

/** Stops the periodic flush timer and flushes whatever remains. */
export async function stopTrafficBufferTimer(): Promise<void> {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  await flushTrafficEvents();
}

/** Current buffer depth — exposed for the realtime/health views. */
export function trafficBufferDepth(): number {
  return state.buffer.length;
}
