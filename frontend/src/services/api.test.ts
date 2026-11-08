import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "@/services/api";

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("request", () => {
  it("sends the CSRF token on unsafe methods only", async () => {
    vi.stubGlobal("document", { cookie: "sessionid=abc; csrftoken=tok123" });
    const fetch = mockFetch(201, { id: "p1" });
    await request("/projects", { method: "POST", body: "{}" });
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-CSRFToken")).toBe("tok123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(fetch.mock.calls[0][1].credentials).toBe("same-origin");
  });

  it("does not send X-CSRFToken on GET", async () => {
    vi.stubGlobal("document", { cookie: "csrftoken=tok123" });
    const fetch = mockFetch(200, { ok: true });
    await request("/me");
    expect((fetch.mock.calls[0][1].headers as Headers).has("X-CSRFToken")).toBe(false);
  });

  it("parses the backend error envelope", async () => {
    mockFetch(400, { error: { code: "invalid", message: "Invalid request.", details: { name: ["Too short."] } } });
    const err = await request("/projects", { method: "POST", body: "{}" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "invalid", details: { name: ["Too short."] } });
  });

  it("falls back gracefully when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502, statusText: "Bad Gateway" })));
    const err = await request("/me").catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: "error" });
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request("/projects/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
