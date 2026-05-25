/**
 * Server-Sent Events stream for live in-app notifications.
 *
 * The browser opens an EventSource against this endpoint and receives
 * one SSE message per new in-app notification. The bell badge updates
 * without polling or reload.
 *
 * EventSource does not let the client set custom headers, so this
 * endpoint accepts the JWT in a `?token=` query string in addition to
 * the usual Authorization header. It's added to publicRoutes in
 * server/middleware/auth.ts so the middleware doesn't reject it; auth
 * happens here.
 *
 * Heartbeats: an SSE comment is sent every 20 seconds to keep the
 * connection alive through intermediaries that drop idle TCP.
 */
import { verifyAccessToken } from "~/server/utils/jwt";
import { subscribeUser, type StreamEvent } from "~/server/utils/notification-stream";

const HEARTBEAT_INTERVAL_MS = 20_000;

export default defineEventHandler(async (event) => {
  // Auth: token from header OR `?token=` query string. EventSource
  // can't set headers, so query is the practical path for browsers.
  const headerAuth = getHeader(event, "authorization") || "";
  const bearer = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : null;
  const query = getQuery(event);
  const queryToken = typeof query.token === "string" ? query.token : null;
  const token = bearer ?? queryToken;

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const stream = createEventStream(event);

  // Initial hello so the client knows the connection is open.
  await stream.push({ event: "ready", data: JSON.stringify({ at: Date.now() }) });

  const onEvent = (e: StreamEvent) => {
    // Fire-and-forget; the stream queues internally and rejects only
    // when the underlying writer has gone away.
    stream.push({ event: "notification", data: JSON.stringify(e) }).catch(() => {
      /* client likely disconnected — onClosed below will clean up */
    });
  };
  const unsubscribe = subscribeUser(payload.userId, onEvent);

  const heartbeat = setInterval(() => {
    // Comment lines are valid SSE and are ignored by EventSource — they
    // exist solely to keep the connection alive through proxies.
    stream
      .push({ comment: "hb" } as never)
      .catch(() => {
        /* ignore */
      });
  }, HEARTBEAT_INTERVAL_MS);

  stream.onClosed(() => {
    clearInterval(heartbeat);
    unsubscribe();
  });

  return stream.send();
});
