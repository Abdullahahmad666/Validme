"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearch, FolderKanban, Home, Plus, User } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/research/new", label: "Research", icon: Plus },
  { href: "/evidence", label: "Evidence", icon: FileSearch },
  { href: "/settings", label: "Account", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card lg:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
