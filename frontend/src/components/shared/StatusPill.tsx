import { Archive, CheckCircle2, FileEdit, Loader2, type LucideIcon } from "lucide-react";
import type { ProjectStatus } from "@/types/api";

// Status is never colour-only: icon + text.
const STATUS: Record<ProjectStatus, { label: string; icon: LucideIcon; className: string }> = {
  DRAFT: { label: "Draft", icon: FileEdit, className: "bg-muted text-muted-foreground" },
  RESEARCHING: { label: "Researching", icon: Loader2, className: "bg-primary/10 text-primary" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, className: "bg-success/10 text-success" },
  ARCHIVED: { label: "Archived", icon: Archive, className: "bg-muted text-muted-foreground" },
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}
