import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-2 text-xl font-semibold">
        {BRAND_NAME}
      </Link>
      <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">{BRAND_TAGLINE}</p>
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-sm">{children}</div>
    </main>
  );
}
