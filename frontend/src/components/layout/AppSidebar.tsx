"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  FileSearch,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Plus,
  Settings,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { BrandLink } from "@/components/shared/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/projects", label: "My projects", icon: FolderKanban },
      { href: "/research/new", label: "New research", icon: Plus },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/evidence", label: "Evidence explorer", icon: FileSearch },
      { href: "/opportunities", label: "Opportunities", icon: BarChart3 },
      { href: "/competitors", label: "Competitors", icon: Swords },
      { href: "/distribution", label: "Audience & distribution", icon: Megaphone },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/billing", label: "Subscription & usage", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    // Tablet (md): 64px icon rail. Desktop (lg+): full 250px sidebar. Mobile uses MobileNav.
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-2 py-5 md:flex lg:w-[250px] lg:px-3">
      {/* Rail (md): mark only. Full sidebar (lg+): mark + name. */}
      <BrandLink
        href="/dashboard"
        label={`${BRAND_NAME} dashboard`}
        className="mb-6 justify-center lg:justify-start lg:px-3"
        nameClassName="hidden lg:inline"
      />
      <nav aria-label="Main" className="flex flex-col gap-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-2 hidden px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
              {group.section}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      title={label}
                      className={`flex min-h-11 items-center justify-center gap-2.5 rounded-control px-3 py-2 text-sm lg:justify-start ${
                        active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-background"
                      }`}
                    >
                      <Icon size={16} aria-hidden className="shrink-0" />
                      <span className="sr-only lg:not-sr-only">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
