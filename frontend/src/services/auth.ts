import { getCsrfToken, UNSAFE_METHODS } from "@/lib/csrf";
import type { AuthConfig, AuthErrorItem, AuthResponse, Session } from "@/types/auth";

// django-allauth headless, browser client (session cookie). Proxied by next.config.ts.
const AUTH_URL = "/_allauth/browser/v1";

export class AuthError extends Error {
  constructor(
    public status: number,
    public errors: AuthErrorItem[],
  ) {
    super(errors[0]?.message ?? "Something went wrong. Please try again.");
    this.name = "AuthError";
  }

  /** Field-level messages keyed by param (email, password), for form errors. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.errors) if (e.param && !out[e.param]) out[e.param] = e.message;
    return out;
  }
}

async function call(path: string, init: RequestInit = {}): Promise<AuthResponse> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }
  const res = await fetch(`${AUTH_URL}${path}`, { ...init, method, headers, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({ status: res.status }))) as AuthResponse;
  return { ...body, status: body.status ?? res.status };
}

/** 200 = authenticated; 401 = anonymous or a pending flow (e.g. verify_email); anything else is an error. */
export function toSession(r: AuthResponse): Session {
  if (r.status === 200 && r.data?.user) return { isAuthenticated: true, user: r.data.user };
  if (r.status === 401) {
    const pending = r.data?.flows?.find((f) => f.is_pending)?.id;
    return { isAuthenticated: false, pendingFlow: pending };
  }
  throw new AuthError(r.status, r.errors ?? []);
}

export const auth = {
  config: async () => (await call("/config")) as unknown as AuthConfig,
  session: async () => toSession(await call("/auth/session")),

  login: async (email: string, password: string) =>
    toSession(await call("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),

  signup: async (email: string, password: string) =>
    toSession(await call("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })),

  logout: async () => {
    // allauth answers a successful logout with 401 (no longer authenticated).
    const r = await call("/auth/session", { method: "DELETE" });
    if (r.status !== 401 && r.status !== 200) throw new AuthError(r.status, r.errors ?? []);
  },

  verifyEmail: async (key: string) =>
    toSession(await call("/auth/email/verify", { method: "POST", body: JSON.stringify({ key }) })),

  /**
   * OAuth must be a top-level navigation, so allauth expects a real form POST
   * (not fetch). The browser is redirected to Google, then back to callbackUrl.
   */
  redirectToProvider: (provider: string, callbackUrl: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${AUTH_URL}/auth/provider/redirect`;
    const fields: Record<string, string> = {
      provider,
      callback_url: callbackUrl,
      process: "login",
      csrfmiddlewaretoken: getCsrfToken() ?? "",
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  },
};
