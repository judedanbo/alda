import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore, type User } from "~/stores/auth";

const makeUser = (roles: string[]): User => ({
  id: "u1",
  email: "u@example.com",
  phone: null,
  emailVerified: true,
  phoneVerified: false,
  phoneVerifiedAt: null,
  roles,
});

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("auth store active role", () => {
  it("defaults effectiveRole to the highest-precedence available role", () => {
    const store = useAuthStore();
    store.user = makeUser(["applicant", "schedule_officer"]);
    // schedule_officer outranks applicant in ROLE_ORDER.
    expect(store.effectiveRole).toBe("schedule_officer");
    expect(store.isOfficer).toBe(true);
    expect(store.isApplicant).toBe(false);
    expect(store.dashboardPath).toBe("/officer/dashboard");
  });

  it("availableRoles is ordered by precedence and excludes unheld roles", () => {
    const store = useAuthStore();
    store.user = makeUser(["applicant", "legal_unit"]);
    expect(store.availableRoles).toEqual(["legal_unit", "applicant"]);
  });

  it("setActiveRole switches the effective role and dashboard", () => {
    const store = useAuthStore();
    store.user = makeUser(["schedule_officer", "legal_unit"]);
    store.setActiveRole("legal_unit");
    expect(store.effectiveRole).toBe("legal_unit");
    expect(store.isLegalUnit).toBe(true);
    expect(store.isOfficer).toBe(false);
    expect(store.dashboardPath).toBe("/legal/dashboard");
  });

  it("ignores setActiveRole for a role the user does not hold", () => {
    const store = useAuthStore();
    store.user = makeUser(["applicant"]);
    store.setActiveRole("admin");
    expect(store.activeRole).toBeNull();
    expect(store.effectiveRole).toBe("applicant");
    expect(store.isAdmin).toBe(false);
  });

  it("falls back to precedence when a persisted activeRole is no longer held", () => {
    const store = useAuthStore();
    store.user = makeUser(["applicant"]);
    // Simulate a stale value restored from localStorage by the plugin.
    store.activeRole = "admin";
    expect(store.effectiveRole).toBe("applicant");
    expect(store.dashboardPath).toBe("/applicant/dashboard");
  });

  it("has no effective role when there is no user", () => {
    const store = useAuthStore();
    expect(store.effectiveRole).toBeNull();
    expect(store.availableRoles).toEqual([]);
  });
});
