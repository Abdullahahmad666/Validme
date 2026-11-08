"use client";

import { Button } from "@/components/ui/button";
import { useAuthConfig } from "@/hooks/useSession";
import { auth } from "@/services/auth";

/** Rendered only when the backend has Google OAuth configured (GOOGLE_CLIENT_ID/SECRET). */
export function GoogleButton({ next }: { next: string }) {
  const { data } = useAuthConfig();
  const google = data?.data.socialaccount?.providers.find((p) => p.id === "google");
  if (!google) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => auth.redirectToProvider("google", `${window.location.origin}${next}`)}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
        </svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
