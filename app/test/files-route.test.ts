import { describe, expect, it, vi, beforeEach } from "vitest";

const storageMock = vi.hoisted(() => ({
  statObjectMeta: vi.fn(),
  getObjectStream: vi.fn(),
}));
vi.mock("~/server/services/storage.service", () => storageMock);

const getQueryMock = vi.hoisted(() => vi.fn());
const setResponseHeaderMock = vi.hoisted(() => vi.fn());
const sendStreamMock = vi.hoisted(() => vi.fn(() => "STREAM"));
vi.stubGlobal("getQuery", getQueryMock);
vi.stubGlobal("setResponseHeader", setResponseHeaderMock);
vi.stubGlobal("sendStream", sendStreamMock);
vi.stubGlobal("useRuntimeConfig", () => ({ jwtSecret: "unit-test-secret" }));
vi.stubGlobal("createError", (e: { statusCode: number; message?: string }) => {
  const err = new Error(e.message || "error") as Error & { statusCode: number };
  err.statusCode = e.statusCode;
  return err;
});

const { signFileUrl } = await import("~/server/utils/file-url");
const handler = (await import("~/server/api/files/[...key].get")).default;

function eventFor(url: string) {
  const [, qs] = url.split("?");
  const q = new URLSearchParams(qs);
  getQueryMock.mockReturnValue({ exp: q.get("exp"), sig: q.get("sig") });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { context: { params: { key: "ghana-cards/abc/front.jpg" } } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.statObjectMeta.mockResolvedValue({ size: 1234, contentType: "image/jpeg" });
  storageMock.getObjectStream.mockResolvedValue("READABLE");
  sendStreamMock.mockReturnValue("STREAM");
});

describe("GET /api/files/[...key]", () => {
  it("streams the object for a valid signature", async () => {
    const res = await handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", 900)));
    expect(storageMock.statObjectMeta).toHaveBeenCalledWith("ghana-cards/abc/front.jpg");
    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), "Content-Type", "image/jpeg");
    expect(sendStreamMock).toHaveBeenCalledWith(expect.anything(), "READABLE");
    expect(res).toBe("STREAM");
  });

  it("403s an invalid signature", async () => {
    const url = signFileUrl("ghana-cards/abc/front.jpg", 900).replace(/sig=.+$/, "sig=deadbeef");
    await expect(handler(eventFor(url))).rejects.toMatchObject({ statusCode: 403 });
    expect(storageMock.statObjectMeta).not.toHaveBeenCalled();
  });

  it("403s an expired signature", async () => {
    await expect(handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", -10))))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("propagates a 404 when the object is missing", async () => {
    const err = Object.assign(new Error("not found"), { statusCode: 404 });
    storageMock.statObjectMeta.mockRejectedValueOnce(err);
    await expect(handler(eventFor(signFileUrl("ghana-cards/abc/front.jpg", 900))))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
