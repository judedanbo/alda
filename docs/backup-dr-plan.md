# Backup & Disaster Recovery Plan — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Backup, restore, and disaster-recovery plan for
> ADLA's data stores and service. Aligned to **ISO/IEC 27001:2022 A.8.13 /
> A.5.29-30** and the **Data Protection Act, 2012 (Act 843)** availability/
> integrity duty. Pre-filled from the ADLA codebase; `[TBD]` items need the
> ops/infrastructure owner to confirm.
>
> Companion documents: `docs/incident-response-plan.md` (recovery phase),
> `docs/key-management-procedure.md` (§8 — restoring encrypted backups needs the
> right key version), `docs/dpia.md` (risk **R9** availability), 
> `docs/audit-documentation-checklist.md` (J-series).

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Owner | `[TBD]` (Infrastructure / DevOps lead) |
| Approver | `[TBD]` (accountable owner / SIRO) |
| Date created | 2026-06-03 |
| Review cadence | Annually and after any architecture or DR test. |
| Last restore test | `[TBD]` |

---

## 1. Purpose & scope

**Purpose.** Ensure ADLA data can be recovered and the service restored within
agreed targets after data loss, corruption, or disaster — so applicants can meet
statutory declaration deadlines and no PII is permanently lost.

**Scope — systems to protect:**

| Component | Holds | Criticality |
| --- | --- | --- |
| **PostgreSQL** | All structured data: profiles, encrypted national-IDs, declarations, audit logs, notifications. | **Critical** |
| **MinIO / object storage** (`adla-uploads`) | Ghana Card images, receipt PDFs, scanned reissue letters. | **Critical** |
| **Encryption keys** (K1/K2 etc.) | Decrypt PII in backups. | **Critical** — see key-management §8. |
| **Redis** | Queues (BullMQ audit/notifications), analytics cache, rate-limit state. | Important (mostly transient; queued jobs in flight matter). |
| **Application config/secrets** | Secret store entries, env config. | Critical (recover via secret store, not DB backup). |
| **Application code** | Git repository. | Recoverable from source control / CI. |

---

## 2. Recovery objectives (RPO / RTO)

> Set per business tolerance. **`[TBD]` — confirm with the business owner.**

| Component | RPO (max data loss) | RTO (max downtime) | Rationale |
| --- | --- | --- | --- |
| PostgreSQL | `[TBD]` (e.g. ≤15 min via PITR/WAL) | `[TBD]` (e.g. ≤4 h) | Loss of declarations/audit trail is high-impact. |
| Object storage | `[TBD]` (e.g. ≤24 h) | `[TBD]` (e.g. ≤4 h) | Ghana Card images are irreplaceable if lost. |
| Encryption keys | 0 (must never be lost) | Immediate (from escrow) | Without keys, encrypted data is unrecoverable (DPIA R11). |
| Redis | Tolerant of loss; queues retry | `[TBD]` | Audit/notification jobs reprocess; rate-limit state rebuilds. |
| Whole service | — | `[TBD]` overall RTO | Statutory deadline sensitivity. |

---

## 3. Backup strategy

| Component | Method | Frequency | Retention | Location |
| --- | --- | --- | --- | --- |
| PostgreSQL | `[TBD]` — automated snapshots + WAL/PITR (managed DB) or `pg_dump`/base backup + WAL archiving | `[TBD]` (e.g. continuous WAL + daily full) | `[TBD]` (e.g. 30 days + monthly long-term) | Off-host, separate failure domain `[TBD]` |
| Object storage | `[TBD]` — bucket replication / versioning + periodic export | `[TBD]` | `[TBD]` | Separate region/bucket `[TBD]` |
| Encryption keys | Escrow per key-management §8 | On change | Retain retired versions while any backup encrypted under them exists | Separate access-controlled store |
| Config/secrets | Secret store's own backup/versioning | On change | `[TBD]` | Secret store |

**Backup security & integrity (must-haves):**
- Backups are **encrypted at rest** and access-controlled (they contain
  Restricted-PII). Pseudonymization note: national-IDs are already
  field-encrypted, but Ghana Card images and other fields are not — protect the
  whole backup accordingly.
- Backups stored in a **separate failure domain** from production (different
  host/region) so one disaster can't take both.
- **Immutability / write-once** where possible to resist ransomware/tampering.
- Backup jobs are **monitored**; failures alert `[TBD]`.
- **3-2-1 principle** target: ≥3 copies, ≥2 media/locations, ≥1 off-site/offline `[TBD]`.

---

## 4. Restore procedures

> Document concrete, tested commands in the ops runbook. Key sequencing:

### 4.1 PostgreSQL restore
1. Provision/clean target DB.
2. Restore latest base backup; replay WAL to the chosen point (PITR) for minimal RPO.
3. Verify with `prisma migrate status` and integrity checks on key tables
   (declarations count, audit-log continuity).
4. Confirm the **PII encryption key version** in the environment matches the one
   that encrypted the restored rows (key-management §8) — otherwise national-IDs
   won't decrypt.

### 4.2 Object storage restore
1. Restore/replicate `adla-uploads` from backup/replica or version history.
2. Spot-check a known Ghana Card image and a receipt PDF render.
3. Re-verify bucket is **private** (no public-read) after restore (DPIA R1).

### 4.3 Redis / queues
1. Recreate Redis; queues (`audit`, `notifications`) reprocess pending jobs.
2. If Redis state is lost, the app falls back to in-memory/inline modes — confirm
   `REDIS_URL` reconnects and workers resume.

### 4.4 Application
1. Redeploy from CI/image; inject secrets from the secret store (not from backups).
2. Run the post-deploy smoke checks in `docs/production-checklist.md`.

---

## 5. Disaster scenarios & response

| Scenario | Response summary |
| --- | --- |
| DB corruption / accidental mass delete | PITR restore to just before the event (§4.1). |
| Object-store data loss | Restore from replica/version history (§4.2). |
| Region/host outage | Fail over to `[TBD]` DR target; restore from off-site backups. |
| Ransomware / tampering | Recover from immutable/offline backups; rotate secrets (key-mgmt §6/§7); follow IR plan. |
| **Encryption key loss** | Recover from **escrow** (key-mgmt §8) — there is no other path; this is why escrow is mandatory. |
| Total loss (site + primary backups) | Recover from off-site copy; this is the worst-case the 3-2-1 strategy guards against. |

Declare a disaster via the **Incident Response Plan** (`incident-response-plan.md`);
the Incident Manager coordinates; this plan provides the recovery mechanics.

---

## 6. Testing & assurance

> Auditors specifically want **evidence a restore was actually performed** — an
> untested backup is not a control.

| Test | Frequency | Owner | Last done |
| --- | --- | --- | --- |
| PostgreSQL restore-to-scratch + integrity check | `[TBD]` (≥ quarterly) | DevOps | `[TBD]` |
| Object-storage restore spot-check | `[TBD]` | DevOps | `[TBD]` |
| **Key escrow recovery test** | `[TBD]` | ISO + custodians | `[TBD]` |
| Full DR failover drill | `[TBD]` (≥ annually) | DevOps + IRT | `[TBD]` |
| Backup-monitoring alert test | `[TBD]` | DevOps | `[TBD]` |

Record each test's date, scope, result, and any RPO/RTO gaps found.

---

## 7. Roles & responsibilities

| Role | Responsibility |
| --- | --- |
| Infra/DevOps lead (owner) | Backup config, monitoring, restore execution, DR drills. |
| ISO | Backup security (encryption, immutability, access), key-escrow recovery. |
| K1/K2 custodians | Provide/recover encryption keys during restore. |
| Incident Manager | Declares disaster, coordinates recovery (IR plan). |
| Business owner | Sets/approves RPO/RTO; accepts residual availability risk. |

---

## 8. Open items to finalize

1. Set and approve **RPO/RTO** per component (§2).
2. Choose concrete **backup tooling, frequency, retention, and off-site location** (§3).
3. Enable **encryption, immutability, and monitoring** on backups.
4. Stand up a **DR target** / failover plan and document the runbook commands.
5. Schedule and **perform the first restore test and key-escrow recovery test**;
   record evidence (closes DPIA R9 and supports key-management §8).
6. Confirm **object-storage versioning/replication** is enabled on `adla-uploads`.

---

*Working scaffold, not legal advice. Validate RPO/RTO, retention and DR
arrangements with business and infrastructure leadership.*
