import { UserMenu } from "@/components/layout/UserMenu";
import { BrandLink } from "@/components/shared/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";

/** Top bar: brand on mobile (sidebar shows it from md up), credits + account menu everywhere. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6 md:justify-end lg:px-8">
      <BrandLink href="/dashboard" label={`${BRAND_NAME} dashboard`} className="md:hidden" />
      <UserMenu />
    </header>
  );
}
