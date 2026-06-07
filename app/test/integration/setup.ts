/**
 * Setup for the real-Postgres integration suite.
 *
 * Unlike test/setup.ts (which mocks Prisma), this points the Prisma singleton
 * at TEST_DATABASE_URL — set BEFORE any handler (and therefore prisma) is
 * imported — and stubs only the h3 globals the handlers reference. Prisma is
 * NOT mocked: handlers run real SQL against the test DB.
 */
import { vi } from "vitest";
import { createError, defineEventHandler, getHeader } from "h3";

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for the integration suite — point it at a " +
      "scratch Postgres with migrations applied, e.g. " +
      "postgresql://adla:adla@localhost:5432/adla_test",
  );
}

// The Prisma singleton reads DATABASE_URL when the client is constructed on
// first import, so this assignment must happen here in the setup file.
process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = "test";
process.env.PII_ENCRYPTION_KEY ||=
  "00000000000000000000000000000000000000000000000000000000000000ff";
process.env.PII_HMAC_KEY ||=
  "00000000000000000000000000000000000000000000000000000000000000aa";

vi.stubGlobal("createError", createError);
vi.stubGlobal("defineEventHandler", defineEventHandler);
vi.stubGlobal("getHeader", getHeader);
// Handlers read query params via getQuery; integration tests exercise the
// default (no-filter) path, so a constant empty query is sufficient.
vi.stubGlobal("getQuery", () => ({}));
// Response headers are irrelevant to these DB-correctness tests.
vi.stubGlobal("setResponseHeader", () => {});
vi.stubGlobal("useRuntimeConfig", () => ({}));
