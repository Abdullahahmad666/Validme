"use client";

import { Loader2, Plus, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AISuggestedBadge } from "@/components/shared/AISuggestedBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerateQueries, useQueries, useQueryMutations } from "@/hooks/useResearch";
import { INTENTS } from "@/lib/wizard";
import { ApiError } from "@/services/api";
import type { QueryIntent, ResearchQuery } from "@/types/api";

function QueryRow({ query, projectId }: { query: ResearchQuery; projectId: string }) {
  const { update, remove } = useQueryMutations(projectId);
  const [text, setText] = useState(query.text);
  const dirty = text.trim() !== query.text;

  function commit() {
    const v = text.trim();
    if (!dirty) return;
    if (v.length < 3) {
      setText(query.text);
      toast.error("Queries need at least 3 characters.");
      return;
    }
    update.mutate({ id: query.id, text: v }, { onError: () => setText(query.text) });
  }

  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={query.enabled}
        onChange={(e) => update.mutate({ id: query.id, enabled: e.target.checked })}
        className="size-5 shrink-0 accent-[var(--primary)]"
        aria-label={`Include “${query.text}”`}
      />
      <Input
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        aria-label="Query text"
        className={`h-10 ${query.enabled ? "" : "text-muted-foreground line-through"}`}
      />
      {query.ai_generated && !query.user_modified && <AISuggestedBadge className="hidden shrink-0 sm:inline-flex" />}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => remove.mutate(query.id)}
        aria-label={`Remove “${query.text}”`}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

function AddQuery({ projectId, intent }: { projectId: string; intent: QueryIntent }) {
  const { create } = useQueryMutations(projectId);
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v.length < 3) return;
    create.mutate(
      { text: v, intent },
      {
        onSuccess: () => setText(""),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't add that query."),
      },
    );
  };
  return (
    <div className="flex gap-2 pl-7">
      <Input
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Add your own query"
        aria-label={`Add a ${intent.replace("_", " ")} query`}
        className="h-10"
      />
      <Button type="button" variant="outline" onClick={add} disabled={text.trim().length < 3 || create.isPending}>
        <Plus aria-hidden />
        Add
      </Button>
    </div>
  );
}

/** Generated queries grouped by intent: add, edit, disable, remove, regenerate a group. */
export function QueryEditor({ projectId }: { projectId: string }) {
  const queries = useQueries(projectId);
  const generate = useGenerateQueries(projectId);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [regenerating, setRegenerating] = useState<QueryIntent | "all" | null>(null);

  function run(intent?: QueryIntent) {
    setRegenerating(intent ?? "all");
    generate.mutate(intent, {
      onError: (e) => {
        if (e instanceof ApiError && (e.status === 503 || e.status === 429)) setAiUnavailable(true);
        else toast.error("Couldn't generate queries. Try again or add your own.");
      },
      onSettled: () => setRegenerating(null),
    });
  }

  if (queries.isPending) return <Skeleton className="h-40" />;
  const list = queries.data ?? [];
  const enabled = list.filter((q) => q.enabled).length;

  return (
    <div className="flex flex-col gap-5">
      {list.length === 0 && (
        <div className="rounded-control border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">
            We&apos;ll write search queries the way your customers talk. You can edit every one.
          </p>
          <Button type="button" className="mt-3" onClick={() => run()} disabled={generate.isPending}>
            {regenerating === "all" ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Generate queries
          </Button>
          {aiUnavailable && (
            <p className="mt-3 text-sm text-muted-foreground">
              AI assistance isn&apos;t available right now. Add your own queries below, or launch without any and
              we&apos;ll search your idea description.
            </p>
          )}
        </div>
      )}
      {INTENTS.map((intent) => {
        const group = list.filter((q) => q.intent === intent.value);
        return (
          <section key={intent.value} aria-labelledby={`intent-${intent.value}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 id={`intent-${intent.value}`} className="text-sm font-semibold">
                  {intent.label} <span className="font-normal text-muted-foreground">· {group.length}</span>
                </h3>
                <p className="text-xs text-muted-foreground">{intent.hint}</p>
              </div>
              {list.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => run(intent.value)}
                  disabled={generate.isPending}
                >
                  {regenerating === intent.value ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RotateCw aria-hidden />
                  )}
                  Regenerate
                </Button>
              )}
            </div>
            {group.length > 0 && (
              <ul className="flex flex-col gap-2">
                {group.map((q) => (
                  <QueryRow key={`${q.id}-${q.text}`} query={q} projectId={projectId} />
                ))}
              </ul>
            )}
            <AddQuery projectId={projectId} intent={intent.value} />
          </section>
        );
      })}
      {list.length > 0 && (
        <p className="text-xs text-muted-foreground" role="status">
          {enabled} of {list.length} queries included. Your research depth decides how many run.
        </p>
      )}
    </div>
  );
}
