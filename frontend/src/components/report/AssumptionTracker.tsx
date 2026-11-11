"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, ExternalLink, Plus, Trash2, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { AiLabel, Panel } from "@/components/report/parts";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, safeHref } from "@/lib/utils";
import { api, ApiError } from "@/services/api";
import type { Assumption, AssumptionStatus, Report } from "@/types/report";

const STATUS: Record<AssumptionStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  untested: { label: "Untested", icon: CircleHelp, className: "text-muted-strong" },
  supported: { label: "Supported", icon: CheckCircle2, className: "text-success-text" },
  contradicted: { label: "Contradicted", icon: XCircle, className: "text-destructive-text" },
};
const MIN_CHARS = 5;

function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const d = err.details as Record<string, unknown> | undefined;
    const first = d && Object.values(d).flat()[0];
    return typeof first === "string" ? first : err.message;
  }
  return fallback;
}

function Row({ a, r, projectId }: { a: Assumption; r: Report; projectId: string }) {
  const qc = useQueryClient();
  const key = ["assumptions", projectId];
  const ids = useId();
  const [note, setNote] = useState(a.note);
  const [noteSaved, setNoteSaved] = useState(false);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const [confirming, setConfirming] = useState(false);

  const update = useMutation({
    mutationFn: (body: Parameters<typeof api.updateAssumption>[2]) => api.updateAssumption(projectId, a.id, body),
    // Optimistic status so the select doesn't snap back while saving.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Assumption[]>(key);
      if (body.status) qc.setQueryData<Assumption[]>(key, (list) => list?.map((x) => (x.id === a.id ? { ...x, status: body.status! } : x)));
      return { prev };
    },
    onError: (_e, _b, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: (_d, body) => {
      if (body.note !== undefined) setNoteSaved(true);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAssumption(projectId, a.id),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const linked = a.evidence.map((e) => e.id);
  const options = Object.values(r.evidence_index).filter((e) => !linked.includes(e.id));
  const S = STATUS[a.status];
  const reviewed = a.source === "ai" && a.status !== "untested";

  return (
    <li className="rounded-control border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium">
          <S.icon className={cn("size-4 shrink-0", S.className)} aria-hidden />
          <span className="min-w-0 break-words">{a.text}</span>
          {a.source === "ai" && <AiLabel>{reviewed ? "AI suggested · reviewed by you" : "AI suggested"}</AiLabel>}
        </p>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${ids}-status`} className="sr-only">
            Status of “{a.text}”
          </Label>
          <select
            id={`${ids}-status`}
            value={a.status}
            onChange={(e) => update.mutate({ status: e.target.value as AssumptionStatus })}
            className="h-11 rounded-control border border-input bg-card px-2 text-sm"
          >
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-note`} className="text-xs text-muted-foreground">
          Notes
        </Label>
        <Textarea
          id={`${ids}-note`}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          onBlur={() => note !== a.note && update.mutate({ note })}
          maxLength={1000}
          rows={2}
          placeholder="What did you learn? e.g. 3 of 5 owners said they'd pay"
        />
        <p className="min-h-4 text-xs text-muted-foreground" role="status" aria-live="polite">
          {update.isPending && note !== a.note ? "Saving…" : noteSaved ? "Saved" : ""}
        </p>
      </div>

      {a.evidence.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 text-sm" aria-label="Linked evidence">
          {a.evidence.map((e) => {
            const href = safeHref(e.source_url);
            return (
              <li key={e.id} className="flex items-center justify-between gap-2">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-w-0 items-start gap-1 hover:text-primary hover:underline">
                    <span className="truncate">{e.title || e.source_url}</span>
                    <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span className="sr-only">(opens source in a new tab)</span>
                  </a>
                ) : (
                  <span className="truncate">{e.title || e.source_url}</span>
                )}
                <button
                  type="button"
                  className="min-h-11 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive-text"
                  aria-label={`Unlink ${e.title || e.source_url}`}
                  onClick={() => update.mutate({ evidence_ids: linked.filter((x) => x !== e.id) })}
                >
                  Unlink
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {picking ? (
          <>
            <Label htmlFor={`${ids}-pick`} className="sr-only">
              Evidence to link
            </Label>
            <select
              id={`${ids}-pick`}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="h-11 min-w-0 max-w-full flex-1 rounded-control border border-input bg-card px-2 text-sm sm:max-w-md"
            >
              <option value="">Choose a cited record…</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.title || e.source_url).slice(0, 80)}
                </option>
              ))}
            </select>
            <Button
              disabled={!choice || update.isPending}
              onClick={() => {
                update.mutate({ evidence_ids: [...linked, Number(choice)] });
                setPicking(false);
                setChoice("");
              }}
            >
              Link
            </Button>
            <Button variant="ghost" onClick={() => (setPicking(false), setChoice(""))}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setPicking(true)} disabled={options.length === 0 || linked.length >= 20}>
            Link evidence
          </Button>
        )}
        {confirming ? (
          <>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {a.source === "ai" ? "Dismiss suggestion" : "Remove assumption"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={`${a.source === "ai" ? "Dismiss" : "Remove"} “${a.text}”`}>
            <Trash2 aria-hidden /> {a.source === "ai" ? "Dismiss" : "Remove"}
          </Button>
        )}
      </div>
      {(update.isError || remove.isError) && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          {errorText(update.error ?? remove.error, "Couldn't save. Please try again.")}
        </p>
      )}
    </li>
  );
}

/** The founder's assumptions: their status is the founder's call, kept apart from evidence and AI output. */
export function AssumptionTracker({ r }: { r: Report }) {
  const projectId = r.project.id;
  const qc = useQueryClient();
  const hintId = useId();
  const list = useQuery({ queryKey: ["assumptions", projectId], queryFn: () => api.listAssumptions(projectId) });
  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: () => api.createAssumption(projectId, { text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["assumptions", projectId] });
    },
  });
  const counts = (list.data ?? []).reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  const tooShort = text.trim().length < MIN_CHARS;

  return (
    <Panel
      title="Assumptions to test"
      aside={
        list.data && list.data.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {counts.supported ?? 0} supported · {counts.contradicted ?? 0} contradicted · {counts.untested ?? 0} untested
          </span>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Your call, not the AI&apos;s: mark each one as you learn from customers, and link the evidence you rely on.
      </p>
      {list.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading assumptions</span>
          <Skeleton className="h-24" />
        </div>
      ) : list.isError ? (
        <ErrorState title="Couldn't load assumptions" onRetry={() => list.refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.length === 0 && <li className="text-sm text-muted-foreground">None yet. Add the beliefs your idea depends on.</li>}
          {list.data.map((a) => (
            <Row key={a.id} a={a} r={r} projectId={projectId} />
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort) add.mutate();
        }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${hintId}-new`} className="sr-only">
            New assumption
          </Label>
          <Input
            id={`${hintId}-new`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="e.g. Owners will switch from spreadsheets for under $30/month"
            aria-describedby={`${hintId}-hint`}
            className="h-11"
          />
          <p id={`${hintId}-hint`} className="text-xs text-muted-foreground">
            At least {MIN_CHARS} characters.
          </p>
        </div>
        <Button type="submit" className="h-11" disabled={add.isPending || tooShort}>
          <Plus aria-hidden /> Add
        </Button>
      </form>
      {add.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          {errorText(add.error, "Couldn't add it.")}
        </p>
      )}
    </Panel>
  );
}
