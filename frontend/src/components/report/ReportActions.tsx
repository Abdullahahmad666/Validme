"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DEPTHS } from "@/lib/wizard";
import { api, ApiError, reportExportUrl } from "@/services/api";
import type { Depth } from "@/types/api";
import type { ReportVersion } from "@/types/report";

export function ExportMenu({ projectId, reportId, onPrint }: { projectId: string; reportId: number; onPrint: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a href={reportExportUrl(projectId, reportId)} download>
            <FileText aria-hidden /> Markdown (.md)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPrint}>
          <Printer aria-hidden /> PDF (print / save as PDF)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HistorySelect({ versions, value, onChange }: { versions: ReportVersion[]; value: number; onChange: (id: number) => void }) {
  if (versions.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Version</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 rounded-control border border-input bg-card px-2 text-sm"
      >
        {versions.map((v, i) => (
          <option key={v.id} value={v.id}>
            #{v.id} · {fmtDate(v.created_at)} · {v.depth} · {v.score === null ? "not scored" : `${v.score}/100`}
            {i === 0 ? " (latest)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Re-run with the same setup: shows the credit cost first and needs an explicit confirm (idempotent submit). */
export function RerunPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [depth, setDepth] = useState<Depth>("standard");
  const [key] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const qc = useQueryClient();
  const est = useQuery({ queryKey: ["estimate", projectId, depth], queryFn: () => api.getEstimate(projectId, depth) });
  const run = useMutation({
    mutationFn: () => api.createJob(projectId, `${key}-${depth}`, depth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${projectId}/progress`);
    },
  });
  const error =
    run.error instanceof ApiError && run.error.status === 402
      ? "Not enough credits for this depth."
      : run.error
        ? "Couldn't start the research. Nothing was charged; please try again."
        : null;
  return (
    <section aria-labelledby="rerun-h" className="rounded-card border border-border bg-card p-5">
      <h2 id="rerun-h" className="font-semibold">
        Re-run research
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Uses your current setup and adds a new version to the history. Earlier reports stay available.
      </p>
      <fieldset className="mt-4">
        <legend className="sr-only">Depth</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEPTHS.map((d) => (
            <label
              key={d.value}
              className={cn(
                "flex cursor-pointer flex-col rounded-control border p-3 text-sm",
                depth === d.value ? "border-primary bg-primary/[0.04]" : "border-border",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="depth" value={d.value} checked={depth === d.value} onChange={() => setDepth(d.value)} />
                {d.label}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{d.credits} credit{d.credits === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm" aria-live="polite">
        {est.data
          ? `Costs ${est.data.credits} credit${est.data.credits === 1 ? "" : "s"}. Balance ${est.data.balance} → ${Math.max(est.data.balance_after, 0)}.`
          : est.isError
            ? "Couldn't load the estimate."
            : "Checking credits…"}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => run.mutate()} disabled={!est.data?.sufficient || run.isPending}>
          <RefreshCw aria-hidden /> {run.isPending ? "Starting…" : `Spend ${est.data?.credits ?? "…"} and run`}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
