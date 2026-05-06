# ADLA Deferred Backlog

Items identified during the 2026-05-06 comprehensive audit that are **not** in the demo-ready scope. Grouped by priority for post-demo work.

---

## High Priority (Production Blockers)

### Security Hardening

- [ ] **Rate limiting** — Add rate limiting middleware to `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/resend-verification`. Recommended: 5 attempts per 15 minutes per IP.
- [ ] **Account lockout** — Track failed login attempts per user. Lock account after 5 consecutive failures for 30 minutes. Log lockout events to audit trail.
- [ ] **CORS configuration** — Explicit CORS policy in `nuxt.config.ts` Nitro config. Restrict origins to app domain in production.
- [ ] **CSP headers** — Content Security Policy via Nitro middleware or `nuxt-security` module. At minimum: `default-src 'self'`, script-src, style-src.
- [ ] **Security headers** — Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy. Consider `nuxt-security` module.
- [ ] **CSRF protection** — Add CSRF tokens for form submissions, especially state-changing operations.
- [ ] **Request size limits** — Configure max body size in Nitro to prevent payload-based DoS.
- [ ] **Hard email verification** — Switch login from soft warning to hard block for unverified emails in production.

### Testing

- [ ] **Vitest configuration** — Create `vitest.config.ts` with Nuxt preset, path aliases, and test utilities.
- [ ] **Unit tests for server utils** — JWT helpers, code generator, validators, audit logger.
- [ ] **Unit tests for services** — Email service, notification service, PDF service (mock external deps).
- [ ] **API integration tests** — Auth flow, declaration lifecycle, role-based access.
- [ ] **Playwright setup** — Install `@playwright/test`, create `playwright.config.ts`.
- [ ] **E2E tests** — Full applicant journey, officer review flow, admin management.

### Audit & Compliance

- [ ] **Audit logging consistency** — Audit every state-changing endpoint. Current gaps: some notification endpoints, profile GET, contact form.
- [ ] **Sensitive data stripping** — Ensure password hashes and tokens are never included in audit log `oldValues`/`newValues` JSON.
- [ ] **Audit log export** — Admin endpoint to export audit logs as CSV/PDF for compliance investigations.

---

## Medium Priority (Quality & Completeness)

### Admin CRUD Completion

- [ ] **Delete institution** — `DELETE /api/admin/institutions/[id]` (soft-delete, set `isActive = false`).
- [ ] **Get single institution** — `GET /api/admin/institutions/[id]`.
- [ ] **Delete user** — `DELETE /api/admin/users/[id]` (soft-delete / deactivate, not hard delete).
- [ ] **Create user (admin)** — `POST /api/admin/users` for bulk-inviting staff users without self-registration.
- [ ] **Update user info** — `PUT /api/admin/users/[id]` for email, phone changes by admin.

### Frontend Quality

- [ ] **Error boundary component** — Global error handler that catches unhandled errors and shows a friendly page.
- [ ] **404 / 403 pages** — Custom error pages for not-found and forbidden routes.
- [ ] **Form persistence** — Auto-save long forms (profile setup wizard) to localStorage to survive page refreshes.
- [ ] **Optimistic updates** — Mark notification as read optimistically, revert on failure.
- [ ] **Search result counts** — "Showing X of Y results" feedback on filtered lists.
- [ ] **Table sorting** — Allow sorting by date, status, name on list pages.
- [ ] **Breadcrumbs** — Navigation breadcrumbs for nested pages (declaration detail, review detail).

### Accessibility

- [ ] **`aria-live` regions** — Announce dynamic content updates (notifications, form errors) to screen readers.
- [ ] **Focus management** — Trap focus in modal dialogs, return focus on close.
- [ ] **Skip navigation** — Add skip-to-content link for keyboard users.
- [ ] **`aria-describedby`** — Link form error messages to their inputs.
- [ ] **Table semantics** — Add `<caption>`, proper `<thead>`/`<tbody>` to all data tables.

---

## Low Priority (Nice-to-Have)

### Infrastructure

- [ ] **Kubernetes manifests** — Create `k8s/base/` with: deployment, service, ingress, configmap, secrets, PVC, HPA. Add overlays for dev/staging/production.
- [ ] **CI/CD pipeline** — GitHub Actions for lint, test, build, deploy.
- [ ] **HTTPS enforcement** — Redirect HTTP → HTTPS in production Nitro config.

### Documentation

- [ ] **Update `.env.example`** — Add SMS provider variables: `SMS_PROVIDER`, `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_SENDER_ID`.
- [ ] **API documentation** — Auto-generate from Zod schemas or add Swagger/OpenAPI spec.
- [ ] **User guide** — End-user documentation for each role's workflow.

### Features

- [ ] **Declaration attachments** — Generic document upload for supporting documents beyond Ghana Card.
- [ ] **Bulk operations** — Import institutions from CSV, batch user invites.
- [ ] **Analytics dashboard** — Charts and trends for admin (declarations over time, processing times, rejection rates).
- [ ] **QR code scanning** — Officer can scan QR code from receipt instead of manual code entry.
- [ ] **Two-factor authentication** — SMS OTP for sensitive operations (role changes, declaration approval).
- [ ] **PWA support** — Offline capability, push notifications.
- [ ] **Data retention automation** — Background job to archive/delete records per `DataRetentionPolicy` table.
- [ ] **Declaration editing** — Allow applicants to edit declarations in PENDING status before submission.
- [ ] **Individual review page** — `pages/officer/review/[id].vue` for detailed single-declaration review with full history.

---

## Source

Identified during comprehensive codebase audit on 2026-05-06. See `docs/superpowers/specs/2026-05-06-demo-ready-design.md` for the demo-ready spec that was prioritized from these findings.
