import { BrandLink } from "@/components/shared/BrandLogo";

/** Full-page branded screen for 404 and unexpected errors, outside the app and marketing shells. */
export function StatusScreen({
  code,
  title,
  body,
  children,
}: {
  code: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border bg-card px-4 sm:px-6">
        <BrandLink href="/" />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
        <p className="text-sm font-semibold tracking-wide text-primary">{code}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-2 flex flex-wrap gap-2">{children}</div>
      </main>
    </div>
  );
}
