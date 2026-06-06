import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

/**
 * Provision exactly one `admin` user from the environment. Unlike prisma/seed.ts,
 * this is MEANT to run in production: it has no demo accounts and no
 * NODE_ENV guard. Credentials come from BOOTSTRAP_ADMIN_EMAIL /
 * BOOTSTRAP_ADMIN_PASSWORD (sourced from the adla-secrets Secret). Idempotent —
 * re-running rotates the admin's password rather than erroring.
 */

const BCRYPT_COST = 12; // matches prisma/seed.ts

export interface BootstrapAdminOptions {
  email: string;
  password: string;
  phone?: string;
}

/** Parse + validate the bootstrap env; throws a clear error if a required value is absent. */
export function readBootstrapEnv(env: NodeJS.ProcessEnv): BootstrapAdminOptions {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim();

  if (!email) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required but was not set.");
  }
  if (!password) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required but was not set.");
  }

  return { email, password, ...(phone ? { phone } : {}) };
}

/** Minimal Prisma surface this function needs — keeps it unit-testable with a mock. */
type AdminPrisma = Pick<PrismaClient, "role" | "user" | "notificationPreference">;

export async function bootstrapAdmin(
  prisma: AdminPrisma,
  opts: BootstrapAdminOptions,
): Promise<void> {
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin", description: "System administrator with full access" },
  });

  const passwordHash = await bcrypt.hash(opts.password, BCRYPT_COST);

  // Update path rotates the password and re-asserts emailVerified.
  // It does NOT re-assign the admin role — operators who strip the role must re-create the user.
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: { passwordHash, emailVerified: true },
    create: {
      email: opts.email,
      passwordHash,
      phone: opts.phone ?? null,
      emailVerified: true,
      roles: {
        create: { roleId: adminRole.id },
      },
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    },
  });
}

async function main(): Promise<void> {
  const opts = readBootstrapEnv(process.env);
  const prisma = new PrismaClient();
  try {
    await bootstrapAdmin(prisma, opts);
    console.log(`✅ Bootstrap admin ready: ${opts.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (`tsx prisma/bootstrap-admin.ts`), so importing
// this module in a test never touches a database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("❌ Bootstrap admin error:", e);
    process.exit(1);
  });
}
