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
    <aside className="hidden w-[250px] shrink-0 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
      <Link href="/dashboard" className="mb-6 px-3 text-lg font-semibold">
        {BRAND_NAME}
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.section}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-control px-3 py-2 text-sm ${
                        active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-background"
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                      {label}
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
