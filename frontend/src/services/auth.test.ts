import { describe, expect, it } from "vitest";
import { AuthError, toSession } from "@/services/auth";

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
