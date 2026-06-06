# Secure Development Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines secure-SDLC requirements and the
> secure-coding standard for ADLA. Closes SoA controls **8.25/8.26/8.27/8.28/
> 8.29/8.31/8.33**. Documents practices already followed in the codebase
> (`CLAUDE.md`). Derives from `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Engineering lead / ISO) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on toolchain change. |

---

## 1. Purpose & scope

Ensure security is built into ADLA throughout design, implementation, testing,
and release. Applies to all code in `app/`, server routes, database schema, and
infrastructure-as-config.

## 2. Secure SDLC requirements

| Phase | Requirement |
| --- | --- |
| Requirements | Capture security & privacy requirements (authz, PII handling, validation) per feature; consult DPIA for PII-touching changes. |
| Design | Follow secure architecture principles (§4); threat-model significant changes. |
| Implementation | Follow the secure-coding standard (§3); reuse shared security utilities. |
| Review | All changes via pull request with **review + approval** before merge; security-relevant changes get security review. |
| Testing | Unit (`vitest`) + e2e (`playwright`) incl. authz/negative cases; lint (`npm run lint`) must pass; security testing (§5). |
| Release | Deploy via CI/images; migrations reviewed; startup gate enforces config (`00.config-validation.ts`). |

## 3. Secure-coding standard (as practiced)

- **Auth on every endpoint** — read `event.context.auth`; never re-verify tokens
  ad hoc; enforce role prefixes and officer scoping (`officer-scope.ts`).
- **Validate all input** — parse `readBody()` via Zod (`validators.ts`,
  `validateBody`); add schemas there, not inline.
- **Parameterized queries only** — via Prisma singleton (`~/server/utils/prisma`);
  never build raw SQL from input; never `new PrismaClient()` elsewhere.
- **Output encoding** — escape user data in templates/emails; no `v-html` with
  untrusted input.
- **No secrets in code** — read via `useRuntimeConfig()`, never `process.env` in
  handlers; never log secrets/PII.
- **PII discipline** — never write Restricted-PII to logs/audit/exports
  (data-classification §4); encrypt via `pii-encryption.ts`.
- **AuthZ over IDs** — verify ownership/scope on every record access (prevent
  IDOR).
- **Audit state changes** — call `createAuditLog` on every transition.
- **Safe defaults / fail closed** — for authz; security middleware fails open
  only on internal errors by design (CLAUDE.md), authz decisions do not.
- **Dependencies** — add deliberately; keep current (see vuln/patch policy).

## 4. Secure architecture principles

Layered middleware ordering (`00.security.ts` → `auth.ts` →
`rate-limit-user.ts`), least privilege, defense in depth, singleton DB client,
centralized validators/audit/notification utilities, separation of concerns
(services vs route handlers) — per `CLAUDE.md`.

## 5. Security testing

| Test | Requirement |
| --- | --- |
| Static analysis / lint | `npm run lint`; consider SAST in CI `[TBD]`. |
| Dependency / SCA scan | In CI; block on high-severity (vuln/patch policy). |
| Secret scanning | In CI to prevent committed secrets `[TBD]`. |
| Unit/e2e incl. authz negatives | Required for security-relevant changes. |
| Independent penetration test | Before go-live and periodically (RR-20) `[TBD]`. |

## 6. Environments & test data

- **Separate dev/test/prod** (SoA 8.31); document the boundary `[TBD]`.
- **No real Restricted-PII in non-production** — use synthetic seed data
  (`prisma/seed.ts`); PII-encryption seed writes encrypted dev values.

## 7. Open items

1. Add **SAST + secret-scanning** gates to CI (`.github/` workflows).
2. Document the **dev/test/prod separation** and test-data policy.
3. Define which changes require **threat modeling / security review**.

---

*Working scaffold, not legal advice.*
