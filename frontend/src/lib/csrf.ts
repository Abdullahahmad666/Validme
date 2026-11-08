// Django sets the `csrftoken` cookie; unsafe requests must echo it in X-CSRFToken.
export function readCookie(name: string, cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return readCookie("csrftoken", document.cookie);
}

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
