# Web Analytics, Abuse Detection & Rate Limiting

In-house traffic analytics, abuse detection (including AI crawler/scraper
detection) and rate limiting, built natively into the ADLA Nuxt 4 / Nitro /
Prisma stack. No hosted analytics product and no new framework — only the
existing dependencies plus the user-agent parser written in-repo.

## 1. Architecture

### Request lifecycle

```
            ┌── Nitro "request" hook (server/plugins/traffic.ts) ──┐
 request ─▶ │  parse UA · classify visitor · sessionize cookies    │
            └──────────────────────────────────────────────────────┘
                 │ event.context.analytics
                 ▼
            00.security.ts   ── blocks / AI policy / IP + route rate limits
                 │            (runs BEFORE auth.ts — floods rejected early)
                 ▼
            auth.ts          ── existing JWT auth (unchanged)
                 ▼
            rate-limit-user.ts ── per-authenticated-user rate limit
                 ▼
            route handler
                 │
            ┌── Nitro "afterResponse" hook ───────────────────────┐
 response ◀ │  build traffic event · async batched DB write ·      │
            │  abuse scoring · AI spoof/cloaked/robots recording   │
            └──────────────────────────────────────────────────────┘
```

Middleware order is by filename: `00.security.ts` < `auth.ts` <
`rate-limit-user.ts`. The capture hooks add **zero user-facing latency** —
`request` is synchronous (UA parse + cookie ops only) and `afterResponse`
runs after the response has already been sent. Every analytics path is
wrapped fail-open: a capture, storage or scoring failure can never break or
slow a real request.

### Components

| Layer | File(s) |
|-------|---------|
| Config (typed accessor) | `server/utils/analytics-config.ts` |
| Counter / state storage | `server/utils/analytics-storage.ts` (Nitro `analytics` mount) |
| Capture plugin | `server/plugins/traffic.ts` |
| Sessionization | `server/utils/sessionization.ts` |
| Async batched writer | `server/utils/traffic-buffer.ts` |
| User-agent parser | `server/utils/user-agent.ts` |
| Request metadata / IP privacy | `server/utils/request-meta.ts` |
| Rate limiter | `server/utils/rate-limit.ts` |
| Abuse scoring + enforcement | `server/utils/abuse.ts` |
| AI agent registry + detection | `server/utils/ai-agents.ts`, `ai-agents.data.ts` |
| Security middleware | `server/middleware/00.security.ts` |
| Per-user limiter | `server/middleware/rate-limit-user.ts` |
| Scheduled tasks | `server/tasks/analytics/{rollup,prune}.ts` |
| Admin API | `server/api/admin/analytics/*` |
| Admin dashboard | `pages/admin/analytics.vue` |

### Storage

Rate-limit counters and transient abuse / AI state live in Nitro's storage
layer (`useStorage("analytics")`), **not** the database. The mount uses the
redis driver when `REDIS_URL` is set (counters correct across instances) and
the in-memory driver otherwise (correct per-instance only). `ioredis` is
already an installed transitive dependency, so the redis driver needs no new
package. Read-modify-write is not atomic; under extreme concurrency a counter
may be off by a few — acceptable for rate limiting, and every operation fails
open.

### Data model

Raw, high-write `TrafficEvent` rows are rolled up by a scheduled task into
`TrafficRollupHourly` / `TrafficRollupDaily`. The dashboard reads **only the
rollups** (the realtime and 429 views read the indexed raw table for their
small, recent windows). Abuse history is `AbuseEvent` + `EnforcementAction`;
the operator allow/block list is `ActorAccessRule`.

Rollup metrics are all **additive** so dashboard ranges sum cheaply.
`unique_visitors` / `unique_sessions` are per-bucket distinct counts — summing
them across buckets is the standard "uniques per bucket" approximation.
`p95_duration_ms` is exact per bucket; a request-weighted average is shown for
a range. New-visitor / new-session counts and `sessions` are exact.

## 2. Configuration reference

All settings live under `runtimeConfig.analytics` (`nuxt.config.ts`), are read
through `getAnalyticsConfig()`, and are driven by env vars (see
`app/.env.example`).

| Env var | Default | Purpose |
|---------|---------|---------|
| `ANALYTICS_ENABLED` | `true` | Master switch for the whole subsystem |
| `ANALYTICS_CAPTURE_ENABLED` | `true` | Capture HTTP requests as traffic events |
| `ANALYTICS_ABUSE_ENABLED` | `true` | Abuse scoring + tiered enforcement |
| `ANALYTICS_AI_DETECTION_ENABLED` | `true` | AI classification + per-category policy |
| `ANALYTICS_RATE_LIMIT_ENABLED` | `true` | Layered rate limiting |
| `ANALYTICS_IP_SALT` | _(change!)_ | Salt for hashing client IPs |
| `ANALYTICS_RESPECT_DNT` | `true` | Honour the `DNT: 1` request header |
| `ANALYTICS_RETENTION_DAYS` | `30` | Raw traffic-event retention |
| `ANALYTICS_ROLLUP_RETENTION_DAYS` | `365` | Rollup + abuse-history retention |
| `ANALYTICS_EXCLUDE_PATHS` | _(see .env.example)_ | Path prefixes excluded from capture/enforcement |
| `ANALYTICS_STORAGE_DRIVER` | `redis` | `redis` or `memory` (auto-falls back to memory if `REDIS_URL` unset) |
| `ANALYTICS_SESSION_WINDOW_MINUTES` | `30` | Anonymous-visitor session inactivity window |
| `ANALYTICS_RL_IP_PER_MIN` | `300` | Global per-IP request limit / minute |
| `ANALYTICS_RL_AUTH_PER_MIN` | `15` | `/api/auth/*` limit / minute |
| `ANALYTICS_RL_WRITE_PER_MIN` | `90` | Mutating-request limit / minute |
| `ANALYTICS_RL_UPLOAD_PER_5MIN` | `30` | `/api/upload*` limit / 5 minutes |
| `ANALYTICS_RL_USER_PER_MIN` | `600` | Per-authenticated-user limit / minute |
| `ANALYTICS_RL_ABUSIVE_MULTIPLIER` | `0.2` | Limit multiplier for throttled actors |
| `ANALYTICS_RL_AI_THROTTLE_MULTIPLIER` | `0.25` | Limit multiplier for throttled AI agents |
| `ANALYTICS_ABUSE_FLOOD_PER_MIN` | `600` | Rolling per-IP flood threshold |
| `ANALYTICS_ABUSE_ERROR_RATE` | `0.6` | 4xx-rate threshold |
| `ANALYTICS_ABUSE_DISTINCT_404` | `12` | Distinct-404 path-scanning threshold |
| `ANALYTICS_ABUSE_FAILED_LOGINS` | `8` | Failed-login threshold |
| `ANALYTICS_ABUSE_SUSPICIOUS_SCORE` | `40` | Score at which an actor is "suspicious" |
| `ANALYTICS_ABUSE_ABUSIVE_SCORE` | `75` | Score at which an actor is "abusive" |
| `ANALYTICS_ABUSE_BLOCK_MINUTES` | `30` | Temporary throttle/block duration |
| `ANALYTICS_AI_TRAINING_POLICY` | `block` | Policy for AI training crawlers |
| `ANALYTICS_AI_SEARCH_POLICY` | `allow` | Policy for AI search-index crawlers |
| `ANALYTICS_AI_LIVE_RETRIEVAL_POLICY` | `log` | Policy for live on-behalf-of-user fetchers |
| `ANALYTICS_AI_UNKNOWN_POLICY` | `throttle` | Policy for unknown/cloaked scrapers |
| `ANALYTICS_AI_ROBOTS_ENFORCEMENT` | `true` | Enforce robots.txt disallow at app level |
| `ANALYTICS_AI_IP_RANGE_REFRESH_HOURS` | `24` | Published AI IP-range refresh interval |

Per-category AI policy values: `allow` · `log` · `throttle` · `block`.

## 3. Rate limiting

A **sliding-window counter** is used: each limiter key stores one small object
(aligned window start, current count, previous count); the effective count is
the current count plus a time-weighted fraction of the previous window. It was
chosen over a token bucket (no refill timer needed) and over a sliding-window
*log* (O(1) storage per actor instead of one entry per request).

Layers, all configurable:

- **Global per-IP** — every request, in `00.security.ts`.
- **Per-route-group** — stricter on `/api/auth/*`, uploads and writes.
- **Per-authenticated-user** — in `rate-limit-user.ts` (after auth).

Throttled abusive actors and throttled AI agents have their limits multiplied
down. Exceeding a limit returns **HTTP 429** with `Retry-After` and the IETF
`RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` headers.

## 4. Abuse detection

`server/utils/abuse.ts` maintains a rolling 10-minute per-IP window and scores
flooding, high 4xx/401/403 rates, repeated failed logins (POST `/api/auth/login`
→ 401), distinct-404 path scanning, hits on known-vulnerable paths (`/.env`,
`/wp-admin`, …) and user-agent / geo churn. The 0-100 score maps onto three
**tiered responses** between the two configured thresholds:

`log-only` → `throttle` → `temporary block`.

Every detection writes an `AbuseEvent` row, every enforcement an
`EnforcementAction` row, and an audit-log entry (new `AuditActions`) — so all
actions surface on `/admin/audit-logs`. Admins can also manually block,
allow-list or unblock an IP from the dashboard (`ActorAccessRule`).

## 5. AI crawler / scraper policy

Default policy for this government PII system:

- **Block** AI **training/dataset crawlers** (GPTBot, ClaudeBot, CCBot,
  Bytespider, Google-Extended, …) — robots.txt **and** app-level enforcement.
- **Log** AI **live-retrieval agents** (ChatGPT-User, Claude-User,
  Perplexity-User, …) acting on behalf of a user prompt.
- **Allow** legitimate **search indexers** (Googlebot, Bingbot, …).
- **Throttle** unknown / cloaked scrapers.

The editable registry is `server/utils/ai-agents.data.ts`. Each AI visitor is
classified as training crawler / search indexer / live-retrieval agent /
unknown-or-cloaked scraper, tagged with provider + category on its traffic
event.

**Identity verification** catches spoofing: forward-confirmed reverse DNS
and/or matching against the provider's published IP ranges (refreshed by the
rollup task). A request claiming a known AI UA from a non-matching IP is
flagged `spoofed` and treated as abusive. Verification is cached in storage and
performed in the background, so the security middleware never pays for a DNS
round-trip; the first request from a new IP is therefore evaluated as
`unverified` until the cached verdict lands.

**Cloaked scrapers** are caught behaviourally: content pages fetched with an
HTTP-client/headless/missing UA, no cookies, no `Accept: text/html`, missing
browser headers, or from datacenter IPs. `robots.txt` (`app/public/robots.txt`)
expresses the policy; an AI agent fetching a disallowed path is recorded as a
robots.txt violator.

## 6. Background tasks

Nitro scheduled tasks (`nitro.experimental.tasks` + `nitro.scheduledTasks`):

- `analytics:rollup` — every 10 min. Re-aggregates a trailing window of raw
  events into the hourly/daily rollups (idempotent delete + insert) and
  refreshes published AI IP ranges on the configured interval.
- `analytics:prune` — daily at 03:30. Deletes raw events past
  `retentionDays`, rollups/abuse history past `rollupRetentionDays`, and
  deactivates expired enforcement actions.

## 7. Privacy & compliance

This is a government system holding sensitive PII; the analytics layer adds
none of its own:

- **Raw IPs are never stored long-term.** `TrafficEvent` / `AbuseEvent` store a
  salted SHA-256 `ip_hash` and a truncated IP (last IPv4 octet / IPv6 suffix
  dropped) for display only. A full IP is held only transiently in storage for
  active rate limiting and AI IP verification. The operator-curated
  `ActorAccessRule` list keeps the raw IP because exact matching requires it.
- **Do-Not-Track** (`DNT: 1`, config flag `ANALYTICS_RESPECT_DNT`) suppresses
  the persistent visitor cookie and referrer storage; the security-essential
  session id and aggregate counts are still captured.
- **Retention.** Raw events default to 30 days; rollups and abuse history to
  365 days. Both are configurable and enforced by the prune task.
- Two dedicated cookies are used — `adla_vid` (visitor) and `adla_sid`
  (session) — kept distinct from the auth `session_id` cookie.

## 8. Notes & assumptions

- `npm run lint` is broken in the repository as cloned (no committed
  `eslint.config.mjs`; `@nuxt/eslint` not wired into `modules`) — pre-existing
  and out of scope. All new analytics files were verified clean against the
  standard `@nuxt/eslint` config.
- The Prisma migration SQL was hand-written (matching the existing migration
  format) because no database is reachable in the build environment; run
  `npm run db:migrate` (or apply `20260521140000_add_analytics_abuse_ratelimit`)
  against a live database.
- Enabling the redis storage driver relies on `ioredis` being present (it is,
  as a transitive dependency). If it is ever removed, set
  `ANALYTICS_STORAGE_DRIVER=memory`.
