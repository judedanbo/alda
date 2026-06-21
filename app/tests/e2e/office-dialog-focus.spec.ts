import { test, expect, type Page } from "@playwright/test";

// Regression guard for the click-to-focus bug in DialogScrollContent.
//
// reka's DialogOverlay registers `@pointerdown.left.prevent`. The scroll variant
// nests the dialog content INSIDE that overlay, so a pointerdown on a plain
// <input> used to bubble up to the overlay and get its default prevented — which
// suppresses the compatibility mousedown and stops the input from focusing on
// click (only the <label for=...> worked). Fixed by `@pointerdown.stop` on the
// content. This test opens the applicant Office dialog (which contains the only
// such plain input, "Designation") and asserts a real click focuses it.
//
// No DB writes: we open the dialog and click, but never submit — so no Prisma
// cleanup is needed. Requires the seeded applicant (`npm run db:seed`).

const APPLICANT_EMAIL = "applicant@adla.gov.gh";
const APPLICANT_PASSWORD = "password123";

/**
 * Wait for the Nuxt client to hydrate. Interacting before hydration leaves
 * v-model state un-reactive. We avoid `networkidle` — the dev server keeps
 * long-lived HMR connections, so that state never settles on app pages.
 */
async function waitForHydration(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
}

/** Log in through the UI as the seeded applicant and land on their dashboard. */
async function loginAsApplicant(page: Page) {
  await page.goto("/auth/login");
  await waitForHydration(page);
  await page.getByLabel("Email address").fill(APPLICANT_EMAIL);
  await page.getByLabel("Password").first().fill(APPLICANT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/applicant\/dashboard/, { timeout: 30_000 });
}

test("Office dialog: clicking the Designation input focuses it", async ({ page }) => {
  await loginAsApplicant(page);

  // An applicant on an applicant route is not bounced by the client middleware
  // (unlike the admin case), so a direct goto is safe here.
  await page.goto("/applicant/profile/edit");
  await waitForHydration(page);

  const openButton = page.getByRole("button", { name: /add (another|your first) office/i });
  const dialog = page.getByRole("dialog");

  // --- No-regression check: outside-click dismissal still works ---
  // Done on a freshly-opened dialog. Note: once focus has entered a text input,
  // reka absorbs the first outside pointerdown (pre-existing modal behaviour,
  // unrelated to this fix), so we assert dismissal BEFORE touching any input.
  // Target the overlay's left gutter (left of the centered, max-w-lg content)
  // at the vertical middle of the viewport — reliably backdrop.
  await openButton.click();
  await expect(dialog.getByRole("heading", { name: /add office/i })).toBeVisible();
  const point = await page.evaluate(() => {
    const content = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
    return { x: Math.max(5, Math.round(content.left / 2)), y: Math.round(window.innerHeight / 2) };
  });
  await page.mouse.click(point.x, point.y);
  await expect(dialog).toBeHidden();

  // --- Core regression assertion ---
  // Re-open, then a real click on the plain Designation input must focus it.
  // Before the fix this failed — the overlay's pointerdown.prevent swallowed the
  // native focus and focus stayed elsewhere.
  await openButton.click();
  await expect(dialog.getByRole("heading", { name: /add office/i })).toBeVisible();
  const designation = dialog.getByPlaceholder(/Deputy Minister/i);
  await designation.click();
  await expect(designation).toBeFocused();

  // Functional guard: focus + typing actually works through the field.
  await designation.fill("Director General");
  await expect(designation).toHaveValue("Director General");
});
