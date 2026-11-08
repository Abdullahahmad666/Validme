"use client";

import { Coins, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe } from "@/hooks/useSession";

export function UserMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const router = useRouter();
  const initial = me?.email?.[0]?.toUpperCase() ?? "?";

  async function onLogout() {
    try {
      await logout.mutateAsync();
      router.replace("/login");
    } catch {
      toast.error("Couldn't log out. Please try again.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/billing"
        className="flex min-h-11 items-center gap-1.5 rounded-control border border-border bg-card px-3 text-sm tabular-nums"
        aria-label={me ? `${me.credits} research credits` : "Research credits"}
      >
        <Coins size={16} aria-hidden className="text-muted-foreground" />
        {me ? me.credits : "—"}
        <span className="hidden text-muted-foreground sm:inline">credits</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
            <Avatar>
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{me?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onLogout} disabled={logout.isPending}>
            <LogOut aria-hidden />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
