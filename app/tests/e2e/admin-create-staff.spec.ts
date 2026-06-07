import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Dedicated client pointed at the dev DB by explicit URL. We do NOT rely on the
// test process having loaded app/.env — the URL is hard-coded to the local
// docker-compose Postgres used for development.
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://adla:adla@localhost:5432/adla" } },
});

const ADMIN_EMAIL = "admin@adla.gov.gh";
const ADMIN_PASSWORD = "password123";

// Track every email we create so afterAll can purge them and keep reruns clean.
const createdEmails: string[] = [];

test.afterAll(async () => {
  for (const email of createdEmails) {
    // Cascade deletes roles, tokens, offices, notification prefs.
    await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
  }
  await prisma.$disconnect();
});

/**
 * Wait for the Nuxt client to hydrate. Filling/clicking before hydration leaves
 * v-model state un-reactive (the input shows the value but the handler sees an
 * empty form), so we give hydration a beat. We deliberately avoid
 * `networkidle` — the dev server keeps long-lived HMR/prefetch connections, so
 * that state never settles on app pages.
 */
async function waitForHydration(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
}

/** Log in through the UI as the seeded admin and wait for the admin dashboard. */
async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  await waitForHydration(page);
  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").first().fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 30_000 });
}

test("admin creates a legal_unit staff user; invitee activates account", async ({ page }) => {
  const email = `e2e-legal-${Date.now()}@adla.test`;
  createdEmails.push(email);

  await loginAsAdmin(page);

  // Go to user management.
  // Navigate to user management via the in-app nav link (NOT page.goto). A hard
  // reload re-runs the client middleware before fetchUser() populates the
  // store's roles, so isAdmin is briefly false and the middleware bounces an
  // admin to /applicant/dashboard. SPA navigation keeps the store warm.
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await page.waitForURL(/\/admin\/users/, { timeout: 30_000 });
  await waitForHydration(page);

  // Open the create dialog.
  await page.getByRole("button", { name: /create user/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /create user/i })).toBeVisible();

  // Fill the email and select the legal_unit role.
  await dialog.getByLabel(/email/i).fill(email);
  await dialog
    .locator("label", { hasText: "legal_unit" })
    .getByRole("checkbox")
    .click();

  // Submit (button label is "Create & Invite").
  await dialog.getByRole("button", { name: /create & invite/i }).click();

  // Success alert, then the refreshed list shows the new user with an
  // "Invitation pending" badge. The DataTable renders div-based rows (not a
  // semantic <table>), so we locate by the email text rather than getByRole row.
  await expect(page.getByText(`Invitation sent to ${email}`)).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/invitation pending/i).first()).toBeVisible();

  // Pull the invite token straight from the DB (MailHog is not running).
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  expect(user).not.toBeNull();
  expect(user!.emailVerified).toBe(false);

  const inviteToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
  });
  expect(inviteToken).not.toBeNull();

  // Drop the admin session, then visit the accept-invite link.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/auth/accept-invite?token=${inviteToken!.token}`);

  // The token is verified on mount (email gets marked verified) and the
  // set-password form appears.
  await expect(page.getByText("Set your password", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await waitForHydration(page);

  // Set a valid password (>=8 chars, upper, lower, number).
  const newPassword = "NewPass123";
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: /activate account/i }).click();

  // Success state.
  await expect(page.getByText(/account activated/i)).toBeVisible({
    timeout: 15_000,
  });

  // Verify the full chain end-to-end in the DB: email verified + token consumed.
  const verifiedUser = await prisma.user.findUnique({
    where: { id: user!.id },
  });
  expect(verifiedUser!.emailVerified).toBe(true);

  const consumedToken = await prisma.passwordResetToken.findUnique({
    where: { id: inviteToken!.id },
  });
  expect(consumedToken!.usedAt).not.toBeNull();

  // Optional UI re-login as the new user to prove the password works.
  await page.evaluate(() => localStorage.clear());
  await page.goto("/auth/login");
  await waitForHydration(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").first().fill(newPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/legal\/dashboard/, { timeout: 30_000 });
});

test("create user requires an office when schedule_officer is selected", async ({ page }) => {
  const email = `e2e-officer-${Date.now()}@adla.test`;
  // This user should never be created (validation blocks it), but track the
  // email anyway in case the negative assertion ever regresses.
  createdEmails.push(email);

  await loginAsAdmin(page);
  // Navigate to user management via the in-app nav link (NOT page.goto). A hard
  // reload re-runs the client middleware before fetchUser() populates the
  // store's roles, so isAdmin is briefly false and the middleware bounces an
  // admin to /applicant/dashboard. SPA navigation keeps the store warm.
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await page.waitForURL(/\/admin\/users/, { timeout: 30_000 });
  await waitForHydration(page);

  await page.getByRole("button", { name: /create user/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /create user/i })).toBeVisible();

  await dialog.getByLabel(/email/i).fill(email);
  await dialog
    .locator("label", { hasText: "schedule_officer" })
    .getByRole("checkbox")
    .click();

  // Office checkboxes appear but we leave them all unchecked.
  await expect(dialog.getByText(/collection offices/i).first()).toBeVisible();

  await dialog.getByRole("button", { name: /create & invite/i }).click();

  // Inline office-required error, dialog stays open, no success alert.
  await expect(
    dialog.getByText(/select at least one collection office/i),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByText(`Invitation sent to ${email}`)).toHaveCount(0);

  // Confirm the user was genuinely not persisted.
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  expect(user).toBeNull();
});
