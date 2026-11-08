"use client";

import { usePathname } from "next/navigation";
import { CtaLink } from "@/components/marketing/CtaLink";

/** On /signup offer "Log in"; everywhere else in the auth area offer "Create account". */
export function AuthSwitchButton() {
  const onSignup = usePathname().startsWith("/signup");
  return onSignup ? (
    <CtaLink href="/login" variant="secondary" size="default" className="h-10 px-4">
      Log in
    </CtaLink>
  ) : (
    <CtaLink href="/signup" size="default" className="h-10 px-4">
      Create account
    </CtaLink>
  );
}
