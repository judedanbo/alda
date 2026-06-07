import { describe, expect, it, vi, beforeEach } from "vitest";

const clientMock = vi.hoisted(() => ({
  getObject: vi.fn(),
  statObject: vi.fn(),
}));
// Class form so `new Client(...)` in getMinioClient() works; a constructor
// returning an object yields that object.
vi.mock("minio", () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  Client: class {
    constructor() {
      return clientMock;
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("useRuntimeConfig", () => ({
    minioBucket: "adla-uploads",
    minioEndpoint: "localhost",
    minioPort: 9000,
    minioUseSSL: false,
    minioAccessKey: "x",
    minioSecretKey: "y",
    jwtSecret: "unit-test-secret",
  }));
  vi.stubGlobal("createError", (e: { statusCode: number; message?: string }) => {
    const err = new Error(e.message || "err") as Error & { statusCode: number };
    err.statusCode = e.statusCode;
    return err;
  });
});

const { getObjectStream, statObjectMeta } = await import("~/server/services/storage.service");

describe("storage object fetch error mapping", () => {
  it("maps statObject NotFound (HEAD 404, no body) to 404", async () => {
    clientMock.statObject.mockRejectedValueOnce(Object.assign(new Error("nf"), { code: "NotFound" }));
    await expect(statObjectMeta("ghana-cards/u/front.jpg")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("maps getObject NoSuchKey (GET 404 XML body) to 404", async () => {
    clientMock.getObject.mockRejectedValueOnce(Object.assign(new Error("nf"), { code: "NoSuchKey" }));
    await expect(getObjectStream("ghana-cards/u/front.jpg")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("maps other MinIO errors (AccessDenied) to 502", async () => {
    clientMock.statObject.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "AccessDenied" }));
    await expect(statObjectMeta("ghana-cards/u/front.jpg")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("returns size + content-type on success", async () => {
    clientMock.statObject.mockResolvedValueOnce({ size: 42, metaData: { "content-type": "image/png" } });
    await expect(statObjectMeta("ghana-cards/u/front.jpg")).resolves.toEqual({ size: 42, contentType: "image/png" });
  });
});
