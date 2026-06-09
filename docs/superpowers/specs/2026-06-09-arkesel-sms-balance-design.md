# Arkesel SMS balance check — design

**Date:** 2026-06-09
**Status:** Approved (design)

## Problem

Admins manage SMS provider credentials on the Notifications screen but have no
way to see how much SMS credit remains on the Arkesel account. When the balance
runs out, sends start failing silently (phone verification, notifications) with
no advance warning. Arkesel exposes a balance endpoint; surface it in the
admin Notification Tools UI.

## Goal

An on-demand, admin-only "Check SMS balance" probe in the Notifications → Tools
tab that calls Arkesel and shows remaining SMS units, the account name, and a
low-balance warning.

## Non-goals (YAGNI)

- No background polling or scheduled low-balance alerts.
- No Hubtel / Twilio balance (different APIs; Arkesel is the Ghana primary).
- No caching — it is an on-demand admin action.

## Arkesel API

```
GET https://sms.arkesel.com/sms/api?action=check-balance&api_key=<ARKESEL_API_KEY>
→ {"balance":717,"user":"Richard Mensah","country":"Ghana"}
```

`balance` is the number of **SMS units** remaining. Note this is Arkesel's **v1**
API (`sms.arkesel.com/sms/api`), distinct from the **v2** send endpoint
(`/api/v2/sms/send`) used by `sendViaArkesel` in `sms.service.ts`. Same account
and API key, two different base paths — a code comment will note this so the
version mismatch is not "fixed" later.

## Design

Mirrors the existing SMTP-check feature (`GET /api/admin/smtp-check` +
the "Email server (SMTP) connection" card in `NotificationTools.vue`), which is
the established pattern for an admin provider-health probe.

### 1. Server — `app/server/api/admin/notifications/sms-balance.get.ts`

- Admin-gated: same auth block as `credentials/index.get.ts` (401 if no auth,
  403 unless the user has the `admin` role).
- Resolve the key via `getCredential("sms.arkesel.apiKey")` from
  `notification-config.ts` — this honours the DB override → env → "" chain, so
  the probe checks the **same effective key the sender uses**. It must NOT read
  `process.env.ARKESEL_API_KEY` directly.
- If the resolved key is empty → return `{ ok: false, configured: false }`
  without any outbound call.
- Otherwise GET the Arkesel balance URL, parse the JSON, and classify against
  the low-balance threshold.
- Convention (copied from `smtp-check`): return **HTTP 200 with `ok:false`** for
  a reachable-but-rejected key (bad key / Arkesel error); only a transport-level
  failure (network error, non-JSON) throws.

**Response shape:**

```ts
{
  ok: boolean;          // true when balance was read successfully
  configured: boolean;  // false when no Arkesel key is set
  balance?: number;     // SMS units remaining
  user?: string;        // Arkesel account name
  country?: string;
  low?: boolean;        // balance < LOW_BALANCE_THRESHOLD
  threshold?: number;   // echoes LOW_BALANCE_THRESHOLD for the UI copy
  hint?: string;        // human-readable error/help when ok is false
}
```

**Threshold:** `const LOW_BALANCE_THRESHOLD = 50` (SMS units). Computed
server-side so the rule lives in one place.

### 2. UI — card in `app/components/admin/NotificationTools.vue`

- New "SMS balance (Arkesel)" card, structurally identical to the existing SMTP
  card: a `Button` ("Check SMS balance"), a `checking` loading state, and an
  `Alert` for the result. Reuses the existing `authFetch` + ref pattern.
- States:
  - success → `🟢 717 SMS · Richard Mensah · Ghana`
  - low (`low: true`) → amber/destructive styling + "Top up soon — below {{ threshold }} SMS"
  - `configured: false` → "No Arkesel API key set — add it on the Settings tab."
  - `ok: false` with hint → show the hint.
  - thrown error → generic "SMS balance check failed".

## Error handling

| Situation | Endpoint result | UI |
| --- | --- | --- |
| No key set | `{ ok:false, configured:false }` | "No Arkesel API key set (Settings tab)" |
| Invalid key / Arkesel rejects | `{ ok:false, configured:true, hint }` | show hint |
| Balance below threshold | `{ ok:true, low:true, balance, threshold }` | amber + top-up note |
| Network / non-JSON | thrown 5xx | generic failure message |

## Testing

One endpoint test (mocking the outbound `fetch`):
- unset key → `configured:false`, no outbound call.
- healthy balance → `ok:true, low:false`.
- balance below threshold (e.g. 30) → `low:true`.
- Arkesel rejects → `ok:false` with hint, HTTP 200.

## Files touched

- **new** `app/server/api/admin/notifications/sms-balance.get.ts`
- **edit** `app/components/admin/NotificationTools.vue` (add the card)
- **new** endpoint test alongside the other admin-notification tests
