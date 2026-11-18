import { CircleCheck, CircleStop, EyeOff, FilePen } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  draft: { label: "Draft", icon: FilePen, style: "bg-muted text-muted-strong" },
  published: { label: "Live", icon: CircleCheck, style: "bg-success/10 text-success-text" },
  closed: { label: "Closed", icon: CircleStop, style: "bg-warning/10 text-warning-text" },
  unpublished: { label: "Unpublished", icon: EyeOff, style: "bg-warning/10 text-warning-text" },
} as const;

export type LabStatus = keyof typeof STATUS;

/** Status of a Lab page or survey: icon + text, never colour alone. */
export function StatusBadge({ status }: { status: LabStatus }) {
  const { label, icon: Icon, style } = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", style)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
