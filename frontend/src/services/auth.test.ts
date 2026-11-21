import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, AuthError, toSession } from "@/services/auth";

const user = { id: 1, email: "ana@example.com", display: "ana", has_usable_password: true };

describe("toSession", () => {
  it("maps 200 to an authenticated session", () => {
    expect(toSession({ status: 200, data: { user }, meta: { is_authenticated: true } })).toEqual({
      isAuthenticated: true,
      user,
    });
  });

  it("maps 401 to anonymous and surfaces a pending verification flow", () => {
    expect(toSession({ status: 401, data: { flows: [{ id: "login" }] } })).toEqual({
      isAuthenticated: false,
      pendingFlow: undefined,
    });
    expect(toSession({ status: 401, data: { flows: [{ id: "verify_email", is_pending: true }] } })).toEqual({
      isAuthenticated: false,
      pendingFlow: "verify_email",
    });
  });

  it("throws AuthError with field errors on 400", () => {
    const run = () =>
      toSession({
        status: 400,
        errors: [
          { code: "email_taken", message: "A user is already registered with this email address.", param: "email" },
        ],
      });
    expect(run).toThrow(AuthError);
    try {
      run();
    } catch (e) {
      expect((e as AuthError).fieldErrors()).toEqual({
        email: "A user is already registered with this email address.",
      });
    }
  });
});

const respond = (status: number, body: unknown, json = true) =>
  vi.fn().mockResolvedValue({
    status,
    json: json
      ? async () => body
      : async () => {
          throw new SyntaxError("not json");
        },
  });

describe("auth.config", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the config on a real 200 with data", async () => {
    vi.stubGlobal("fetch", respond(200, { status: 200, data: { account: {}, socialaccount: { providers: [{ id: "google" }] } } }));
    const c = await auth.config();
    expect(c.data.socialaccount?.providers[0].id).toBe("google");
  });

  it("throws instead of returning a body without data when the backend is down or failing", async () => {
    // e.g. the dev proxy's 500 page when Django isn't running: not JSON, no `data` (this crashed the signup page)
    vi.stubGlobal("fetch", respond(500, null, false));
    await expect(auth.config()).rejects.toBeInstanceOf(AuthError);
    vi.stubGlobal("fetch", respond(200, { status: 200 }));
    await expect(auth.config()).rejects.toBeInstanceOf(AuthError);
  });
});
