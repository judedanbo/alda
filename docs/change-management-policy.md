# Change Management Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines how changes to ADLA code, schema, config,
> and infrastructure are proposed, reviewed, approved, deployed, and rolled back.
> Closes SoA control **8.32**; supports **8.19/8.9/8.31**. Derives from
> `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Engineering lead) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on process change. |

---

## 1. Purpose & scope

Ensure changes are made in a controlled, reviewable, reversible way that
preserves security and availability. Scope: application code, Prisma
schema/migrations, configuration/secrets, infrastructure, and deployments.

## 2. Change types

| Type | Definition | Path |
| --- | --- | --- |
| **Standard** | Pre-approved, low-risk, routine. | Normal PR flow. |
| **Normal** | Most changes; needs review + approval. | PR + review + tests + deploy. |
| **Emergency** | Urgent fix (e.g. active incident/vuln). | Expedited deploy with **retrospective** review/approval. |

## 3. Change workflow (as practiced)

1. **Propose** — branch + pull request describing the change and its impact.
2. **Review** — at least one reviewer approval; security review for
   security/PII-relevant changes (secure-development policy).
3. **Test** — `npm run lint`, unit (`vitest`), e2e (`playwright`) pass in CI;
   SCA/secret scans pass `[TBD]`.
4. **Approve** — merge gated on review + green CI.
5. **Deploy** — via CI/images; secrets injected from the secret store; startup
   gate validates config (`00.config-validation.ts`).
6. **Verify** — post-deploy smoke checks (`production-checklist.md`).
7. **Record** — change captured in git history + `[TBD]` change log/ticket.

## 4. Database & schema changes

- Use Prisma migrations (`db:migrate`); review migration SQL.
- Follow `@map`/`@@map` snake_case convention (CLAUDE.md).
- **Multi-step data migrations** (e.g. the PII-encryption two-step + backfill)
  follow the documented sequence (CLAUDE.md / PC) with a tested **rollback**.
- Never `db:push` to production; never edit applied migrations.

## 5. Configuration & secret changes

- Config via env/`runtimeConfig`; secrets via the secret store (KMP) — never
  committed.
- Adding a required secret means updating the **startup gate** and
  `.env.example` placeholder together.

## 6. Rollback

- Every normal/emergency change identifies a **rollback** (revert deploy; for
  schema, a down-migration or compensating migration).
- Data migrations document how to reverse or recover (backups; BDR plan).

## 7. Segregation & environments

- Changes flow dev → test/staging → prod (SoA 8.31).
- Reviewer ≠ sole author where feasible (segregation of duties).
- Production deploy access restricted to authorized personnel (ACP §6).

## 8. Open items

1. Adopt a lightweight **change-record** (ticket/changelog) with approver + date.
2. Define **emergency-change** retrospective-approval steps.
3. Document the **dev/test/prod promotion** path and approvals.
4. Add **SCA/secret-scan** gates to the merge requirements.

---

*Working scaffold, not legal advice.*
