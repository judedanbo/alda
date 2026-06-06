# Logging & Monitoring Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines what ADLA logs, how logs are protected
> and retained, and how the system is monitored. Closes SoA controls **8.15/
> 8.16/8.17**; supports incident detection (IRP §4). Derives from
> `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on change. |

---

## 1. Purpose & scope

Ensure security-relevant events are recorded for detection, investigation, and
compliance, and that ADLA's availability and security posture are monitored.
Scope: application audit logs, traffic/abuse analytics, infrastructure logs.

## 2. What is logged (as implemented)

| Log | Source | Captures |
| --- | --- | --- |
| **Audit log** (compliance) | `audit_logs` via `createAuditLog` (`audit.ts`), durable BullMQ writes | Actor user ID, action (`AuditActions`), entity type/ID, old/new values, timestamp, IP. Every state transition. |
| Security events | audit log | `REFRESH_TOKEN_REPLAY_DETECTED`, lockouts, auth failures. |
| Traffic / abuse | `TrafficEvent`, `AbuseEvent`, `EnforcementAction` | Pseudonymized visitor data, abuse scores, enforcement. |
| Notification delivery | `NotificationDeliveryLog` | Delivery status/metadata. |
| Infrastructure | DB / object-store / proxy / container logs | Access and errors `[TBD]`. |

**Audit logging is a compliance requirement, not a debug aid** — call
`createAuditLog` on every state change (CLAUDE.md).

## 3. What must NOT be logged

- **No Restricted-PII** (national-ID numbers, Ghana Card image contents) in any
  log, incl. `audit_logs` and error output (RR-04; data-classification §4).
- No secrets/keys/tokens. Client IPs in analytics are **hashed** (salted).

## 4. Protection of logs

| Control | Requirement |
| --- | --- |
| Integrity / tamper-evidence | Restrict write/delete; consider append-only/immutable storage `[TBD]`. |
| Access | Audit logs viewable by `admin`/auditors only (RBAC). |
| Durability | Queue-backed writes with retries; failed jobs retained 7 days for review (PC). |
| Time accuracy | Hosts synchronized via **NTP** (SoA 8.17) `[TBD]`. |

## 5. Retention

| Log | Retention (`[TBD]` confirm) |
| --- | --- |
| Audit logs | Set to meet audit/statutory needs (long). |
| Traffic raw events | Pruned per analytics retention (`tasks/analytics/prune.ts`). |
| Notifications | `NOTIFICATIONS_READ/UNREAD_RETENTION_DAYS` (90/180). |
| Infrastructure logs | `[TBD]`. |

## 6. Monitoring & alerting

| Activity | Mechanism | Gap |
| --- | --- | --- |
| Abuse / bot detection | Analytics abuse scorer (`plugins/traffic.ts`) | — |
| Availability | `/api/health` + uptime monitor `[TBD]` | Stand up external monitor. |
| Security alerting | `[TBD]` — alert on replay detection, lockout spikes, bucket-policy change, scan failures | SIEM/alert pipeline (SoA 8.16). |
| Rate-limit / DoS signals | Middleware + analytics | Define alert thresholds. |

Alerts feed the **incident-response process** (IRP §4).

## 7. Review

- Periodic review of audit/security logs `[TBD]` cadence.
- Logs are a primary evidence source during incidents (IRP §5.3) and audits.

## 8. Open items

1. Centralize logs / stand up **SIEM + alerting** (8.16) with defined triggers.
2. Configure **NTP** on all hosts (8.17).
3. Confirm **audit-log retention** and enable tamper-resistant storage.
4. Stand up **external uptime/health monitoring**.

---

*Working scaffold, not legal advice.*
