"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

/** App paths only: never //host or /\host, which browsers treat as other sites. Mirrors the backend check. */
export function internalLink(link: string): string | null {
  return link.startsWith("/") && !link.startsWith("//") && !link.includes("\\") && !link.includes("://") ? link : null;
}

/** In-app notices (competitor changes). Polls once a minute while the tab is visible; text is plain. */
export function NotificationBell() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const read = useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = q.data?.unread ?? 0;
  const items = q.data?.results.slice(0, 8) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell aria-hidden />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,360px)] p-0">
        <DropdownMenuLabel className="px-3 py-2 text-sm">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {q.isPending ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
            Loading…
          </p>
        ) : q.isError ? (
          <DropdownMenuItem className="min-h-11 justify-center text-sm" onSelect={(e) => (e.preventDefault(), q.refetch())}>
            Couldn&apos;t load notifications. Try again
          </DropdownMenuItem>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing new. You&apos;ll see competitor changes here.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild className="items-start whitespace-normal rounded-none">
              <Link
                href={internalLink(n.link) ?? "/competitors"}
                onClick={() => !n.read && read.mutate({ ids: [n.id] })}
                className={cn("flex min-h-11 flex-col gap-0.5 border-b border-border px-3 py-2.5 last:border-0", !n.read && "bg-primary/[0.04]")}
              >
                <span className={cn("flex items-center gap-1.5 text-sm", !n.read && "font-medium")}>
                  {!n.read && (
                    <>
                      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="sr-only">Unread: </span>
                    </>
                  )}
                  {n.title}
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[11px] text-muted-foreground">{fmtDate(n.created_at)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="my-0" />
        {unread > 0 && (
          <DropdownMenuItem className="min-h-11 rounded-none px-3 text-sm text-primary" onSelect={() => read.mutate({ all: true })}>
            <CheckCheck aria-hidden /> Mark all read
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="min-h-11 rounded-none px-3 text-sm font-medium text-primary">
          <Link href="/competitors">All competitor changes</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
