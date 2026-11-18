"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronRight, Download, ExternalLink, Lock, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { QuestionFields } from "@/components/lab/QuestionFields";
import { SampleWarning } from "@/components/lab/SampleWarning";
import { type SlugCheck, SlugHint } from "@/components/lab/SlugHint";
import { StatusBadge } from "@/components/lab/StatusBadge";
import { BarList } from "@/components/charts/BarList";
import { DailyChart, type DailySeries } from "@/components/charts/DailyChart";
import { fillWindow } from "@/components/charts/daily";
import { ShareBars } from "@/components/charts/ShareBars";
import { AiLabel, Panel } from "@/components/report/parts";
import { AISuggestedBadge } from "@/components/shared/AISuggestedBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { labKeys, useAssumptions, useLabSurvey, useSurveyResponses, useSurveyResults, useSurveyStats } from "@/hooks/useLab";
import { emptyQuestion, moveItem, nextQuestionId, pct, QUESTION_LABELS, RETENTION_OPTIONS, slugify, structureOf } from "@/lib/lab";
import { safeHref } from "@/lib/utils";
import { API_URL, api, ApiError } from "@/services/api";
import type { Question, QuestionType, Survey } from "@/types/lab";
import type { Assumption } from "@/types/report";

type Draft = Pick<Survey, "title" | "intro" | "slug" | "questions" | "ask_email" | "retention_days">;

function errorList(err: unknown): string[] {
  if (!(err instanceof ApiError)) return ["Something went wrong. Please try again."];
  const d = err.details as Record<string, unknown> | undefined;
  const flat = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(flat) : typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(flat) : []);
  const fromDetails = d ? flat(d.details ?? d) : [];
  return fromDetails.length ? fromDetails.slice(0, 6) : [err.message];
}

function Results({ projectId, surveyId, assumptions }: { projectId: string; surveyId: number; assumptions: Assumption[] }) {
  const results = useSurveyResults(projectId, surveyId);
  const byId = new Map(assumptions.map((a) => [a.id, a.text]));
  return (
    <Panel title="Results" as="h2" aside={<span className="text-xs text-muted-foreground">Counted by us: no cookies or tracking scripts</span>}>
      {results.isPending ? (
        <Skeleton className="h-24" />
      ) : results.isError ? (
        <ErrorState title="Couldn't load the results" onRetry={() => results.refetch()} />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Answers</dt>
              <dd className="text-2xl font-semibold tabular-nums">{results.data.responses}</dd>
            </div>
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Views</dt>
              <dd className="text-2xl font-semibold tabular-nums">{results.data.views}</dd>
            </div>
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Response rate</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {pct(results.data.response_rate, 1)}
                {results.data.response_rate === null && <span className="block text-xs font-normal text-muted-foreground">No views yet</span>}
              </dd>
            </div>
          </dl>
          <SampleWarning sample={results.data.sample} />
          <SurveyDaily projectId={projectId} surveyId={surveyId} />
          {results.data.responses === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No answers yet. Share the survey&apos;s link with people you think have the problem.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-5">
              {results.data.questions.map((q, i) => (
                <li key={q.id}>
                  <h3 className="text-sm font-semibold">
                    {i + 1}. {q.prompt}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {q.answered} answered{q.assumption_id && byId.get(q.assumption_id) ? ` · tests: “${byId.get(q.assumption_id)}”` : ""}
                  </p>
                  {q.options && q.answered > 0 && (
                    <div className="mt-2">
                      <ShareBars rows={q.options} answered={q.answered} />
                    </div>
                  )}
                  {q.distribution && (
                    <>
                      <div className="mt-2">
                        <BarList
                          rows={q.distribution.map((d) => ({
                            label: d.value === 1 ? `1 · ${q.low_label}` : d.value === 5 ? `5 · ${q.high_label}` : String(d.value),
                            value: d.count,
                          }))}
                          unit="answers"
                          rowHeight={28}
                          emptyText="No answers to this question yet."
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Median: {q.median ?? "—"}</p>
                    </>
                  )}
                  {q.type === "text" && <p className="mt-1 text-sm text-muted-foreground">Typed answers are listed under Answers.</p>}
                  {q.note && <p className="mt-1 text-xs text-muted-foreground">{q.note}</p>}
                  {q.answered > 0 && q.sample.level !== results.data.sample.level && <SampleWarning sample={q.sample} />}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{results.data.note}</p>
        </>
      )}
    </Panel>
  );
}

const SURVEY_SERIES: DailySeries[] = [
  { key: "views", label: "Views", kind: "bar", color: "var(--series-1)" },
  { key: "responses", label: "Answers", kind: "line", color: "var(--series-2)" },
];

/** Views and answers per day over the last 30 days (zero where nothing was counted). */
function SurveyDaily({ projectId, surveyId }: { projectId: string; surveyId: number }) {
  const stats = useSurveyStats(projectId, surveyId);
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold">Last 30 days</h3>
      {stats.isPending ? (
        <Skeleton className="h-44" />
      ) : stats.isError ? (
        <ErrorState title="Couldn't load the daily counts" onRetry={() => stats.refetch()} />
      ) : (
        <DailyChart rows={fillWindow(stats.data.daily, stats.data.since, 30, ["views", "responses"])} series={SURVEY_SERIES} height={180} />
      )}
    </div>
  );
}

function Answers({ projectId, survey }: { projectId: string; survey: Survey }) {
  const qc = useQueryClient();
  const list = useSurveyResponses(projectId, survey.id);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmOne, setConfirmOne] = useState<number | null>(null);
  const del = useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) => api.deleteLabSurveyResponses(projectId, survey.id, body),
    onSuccess: () => {
      setConfirmAll(false);
      setConfirmOne(null);
      qc.invalidateQueries({ queryKey: labKeys.responses(projectId, survey.id) });
      qc.invalidateQueries({ queryKey: labKeys.results(projectId, survey.id) });
      qc.invalidateQueries({ queryKey: labKeys.survey(projectId, survey.id) });
      qc.invalidateQueries({ queryKey: labKeys.surveys(projectId) });
    },
  });
  const rows = list.data?.results ?? [];
  return (
    <Panel
      title="Answers"
      as="h2"
      aside={
        rows.length > 0 ? (
          <a href={`${API_URL}/projects/${encodeURIComponent(projectId)}/lab-surveys/${survey.id}/responses-export`} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        ) : undefined
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Typed answers and emails are stored encrypted and deleted automatically after {survey.retention_days} days. People agreed to
        share their answers with you{survey.ask_email ? " and, if they left an email, to be contacted about this survey" : ""}. If someone
        asks to be removed, delete their answers here.
      </p>
      {list.isPending ? (
        <Skeleton className="h-16" />
      ) : list.isError ? (
        <ErrorState title="Couldn't load the answers" onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No answers yet.</p>
      ) : (
        <>
          {survey.responses > rows.length && (
            <p className="text-xs text-muted-foreground">
              Showing the latest {rows.length} of {survey.responses}. Export CSV for all of them.
            </p>
          )}
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(r.submitted_at)} · deleted after {fmtDate(r.expires_at)}
                    {r.email ? (
                      <>
                        {" · "}
                        <span className="break-all font-medium text-foreground">{r.email}</span>
                      </>
                    ) : null}
                  </p>
                  <dl className="mt-1 grid gap-1">
                    {r.answers.map((a) => (
                      <div key={a.id}>
                        <dt className="text-xs text-muted-foreground">{a.prompt}</dt>
                        <dd className="whitespace-pre-line break-words">{a.answer ?? <span className="text-muted-foreground">No answer</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {confirmOne === r.id ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Button variant="destructive" className="min-h-11" disabled={del.isPending} onClick={() => del.mutate({ ids: [r.id] })}>
                      Delete
                    </Button>
                    <Button variant="ghost" className="min-h-11" onClick={() => setConfirmOne(null)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button size="icon" variant="ghost" className="size-11 shrink-0" onClick={() => setConfirmOne(r.id)} aria-label={`Delete the answers from ${fmtDate(r.submitted_at)}`}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmAll ? (
              <>
                <span className="text-sm">
                  Delete all {Math.max(survey.responses, rows.length)} answers permanently?
                </span>
                <Button variant="destructive" className="min-h-11" disabled={del.isPending} onClick={() => del.mutate({ all: true })}>
                  Delete all
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmAll(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" className="min-h-11" onClick={() => setConfirmAll(true)}>
                Delete all…
              </Button>
            )}
          </div>
        </>
      )}
      {del.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          Couldn&apos;t delete. Please try again.
        </p>
      )}
    </Panel>
  );
}

/** An inert approximation of the public survey, which the server renders on the pages origin. */
export function SurveyPreview({ draft, consent }: { draft: Draft; consent: string }) {
  return (
    <div role="group" className="rounded-card border border-border bg-background p-5 text-sm" aria-label="Survey preview">
      <p className="text-2xl font-bold leading-tight">{draft.title || "Your survey"}</p>
      {draft.intro && <p className="mt-2 whitespace-pre-line text-muted-foreground">{draft.intro}</p>}
      {draft.questions.length === 0 && <p className="mt-4 text-muted-foreground">Add questions to see the survey.</p>}
      <ol className="mt-4 flex flex-col gap-3">
        {draft.questions.map((q, i) => (
          <li key={q.id} className="rounded-control border border-border bg-card p-3">
            <p className="font-semibold">
              {i + 1}. {q.prompt || "Question"}
              {q.required && (
                <>
                  <span className="text-destructive-text" aria-hidden>
                    {" "}
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </>
              )}
            </p>
            {q.help && <p className="text-xs text-muted-foreground">{q.help}</p>}
            {(q.type === "single" || q.type === "multi") && (
              <ul className="mt-1">
                {(q.options ?? []).map((o, j) => (
                  <li key={j}>
                    {q.type === "single" ? "○" : "☐"} {o || "Option"}
                  </li>
                ))}
              </ul>
            )}
            {q.type === "scale" && (
              <p className="mt-1 text-muted-foreground">
                1 ({q.low_label || "Not at all"}) · 2 · 3 · 4 · 5 ({q.high_label || "Very much"})
              </p>
            )}
            {q.type === "text" && <div className="mt-1 h-12 rounded-control border border-border bg-background" />}
          </li>
        ))}
      </ol>
      {draft.ask_email && <div className="mt-3 rounded-control border border-border bg-background px-3 py-2 text-muted-foreground">Email address (optional)</div>}
      <p className="mt-3 text-xs text-muted-foreground">☐ {consent}</p>
      <span className="mt-2 inline-block rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground">Send answers</span>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Footer added to every survey: an early test by an independent founder, with links to privacy, getting a copy or deletion, and
        reporting the survey.
      </p>
    </div>
  );
}

function Editor({ projectId, survey }: { projectId: string; survey: Survey }) {
  const qc = useQueryClient();
  const router = useRouter();
  const ids = { title: useId(), intro: useId(), slug: useId(), retention: useId(), email: useId(), add: useId() };
  const assumptions = useAssumptions(projectId);
  const openAssumptions = (assumptions.data ?? []).filter((a) => a.status !== "contradicted");
  const [draft, setDraft] = useState<Draft>({
    title: survey.title,
    intro: survey.intro,
    slug: survey.slug,
    questions: survey.questions,
    ask_email: survey.ask_email,
    retention_days: survey.retention_days,
  });
  const [dirty, setDirty] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ state: "idle" });
  const [addType, setAddType] = useState<QuestionType>("single");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  // Questions added from an AI suggestion keep their label until the survey is saved (design rule: AI values stay marked
  // until the founder confirms them).
  const [aiIds, setAiIds] = useState<Set<string>>(new Set());
  const live = survey.status === "published" || survey.status === "closed";
  const locked = survey.responses > 0;
  const structureChanged = locked && structureOf(draft.questions) !== structureOf(survey.questions);
  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setQuestion = (i: number, q: Question) => edit({ questions: draft.questions.map((x, j) => (j === i ? q : x)) });
  const refresh = (s: Survey) => {
    qc.setQueryData(labKeys.survey(projectId, survey.id), s);
    qc.invalidateQueries({ queryKey: labKeys.surveys(projectId) });
    qc.invalidateQueries({ queryKey: labKeys.predictedVsActual(projectId) });
    qc.invalidateQueries({ queryKey: labKeys.assumptions(projectId) });
    // The server cleans text (trims, strips control characters): show what was actually saved.
    setDraft({ title: s.title, intro: s.intro, slug: s.slug, questions: s.questions, ask_email: s.ask_email, retention_days: s.retention_days });
    setAiIds(new Set());
  };
  const body = () => ({ ...draft, slug: draft.slug || null });
  const save = useMutation({
    mutationFn: () => api.updateLabSurvey(projectId, survey.id, body()),
    onMutate: () => {
      state.reset();
      setStatusNote("");
    },
    onSuccess: (s) => {
      setDirty(false);
      refresh(s);
    },
  });
  const state = useMutation({
    mutationFn: async (action: "publish" | "close" | "unpublish") => {
      if (action === "publish" && dirty) {
        refresh(await api.updateLabSurvey(projectId, survey.id, body()));
        setDirty(false);
      }
      return api.setLabSurveyState(projectId, survey.id, action);
    },
    onMutate: () => save.reset(),
    onSuccess: (s, action) => {
      setDirty(false);
      refresh(s);
      setStatusNote(
        action === "publish"
          ? "Your survey is live."
          : action === "close"
            ? "Closed: the address now says the survey takes no more answers."
            : "Unpublished: its address now shows “not found”.",
      );
    },
  });
  const suggest = useMutation({ mutationFn: () => api.labSurveySuggest(projectId), onSuccess: (r) => setOffered(r.questions) });
  const remove = useMutation({
    mutationFn: () => api.deleteLabSurvey(projectId, survey.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: labKeys.surveys(projectId) });
      router.push(`/projects/${projectId}/lab`);
    },
  });
  const checkSlug = async () => {
    if (!draft.slug) return setSlugCheck({ state: "idle" });
    try {
      const r = await api.labSlug(draft.slug, { survey: survey.id });
      setSlugCheck(r.available ? { state: "available" } : { state: "taken", reason: r.reason });
    } catch {
      setSlugCheck({ state: "error" });
    }
  };
  const [offered, setOffered] = useState<Question[]>([]);
  const addSuggested = (questions: Question[]) => {
    let next = [...draft.questions];
    const added = new Set(aiIds);
    for (const q of questions) {
      if (next.length >= 12) break;
      const id = nextQuestionId(next);
      next = [...next, { ...q, id }];
      added.add(id);
    }
    edit({ questions: next });
    setAiIds(added);
    setOffered((o) => o.filter((x) => !questions.includes(x)));
  };
  const room = 12 - draft.questions.length;
  const assumptionText = (id?: number | null) => (assumptions.data ?? []).find((a) => a.id === id)?.text;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Panel title="Survey" as="h2" aside={<StatusBadge status={survey.status} />}>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.title}>Title</Label>
              <Input id={ids.title} className="h-11" value={draft.title} maxLength={80} onChange={(e) => edit({ title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.intro}>Introduction (optional)</Label>
              <Textarea id={ids.intro} value={draft.intro} maxLength={400} onChange={(e) => edit({ intro: e.target.value })} aria-describedby={`${ids.intro}-hint`} />
              <p id={`${ids.intro}-hint`} className="text-xs text-muted-foreground">
                Who you are and why you&apos;re asking, in a sentence or two. {draft.intro.length}/400
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.slug}>Web address</Label>
              <div className="flex items-center gap-1 text-sm">
                <span className="max-w-[45%] shrink-0 truncate text-muted-foreground" title={survey.base_url}>{survey.base_url}</span>
                <Input
                  id={ids.slug}
                  className="h-11"
                  value={draft.slug ?? ""}
                  maxLength={48}
                  disabled={live}
                  placeholder={slugify(draft.title) || "your-survey"}
                  onChange={(e) => {
                    edit({ slug: slugify(e.target.value) || null });
                    setSlugCheck({ state: "idle" });
                  }}
                  onBlur={checkSlug}
                  aria-invalid={(!live && slugCheck.state === "taken") || undefined}
                  aria-describedby={`${ids.slug}-hint`}
                />
              </div>
              <SlugHint id={`${ids.slug}-hint`} live={live} check={slugCheck} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={ids.retention}>Keep answers for</Label>
                <select id={ids.retention} className="h-11 rounded-control border border-input bg-background px-3 text-sm" value={draft.retention_days} onChange={(e) => edit({ retention_days: Number(e.target.value) })}>
                  {RETENTION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
              <label htmlFor={ids.email} className="flex min-h-11 items-center gap-2 self-end text-sm">
                <input id={ids.email} type="checkbox" className="size-5 accent-primary" checked={draft.ask_email} disabled={locked} onChange={(e) => edit({ ask_email: e.target.checked })} />
                Ask for an optional email
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Shown to people before they answer. Without an email, answers can&apos;t be traced back to anyone.
              {locked ? " The email setting is fixed once people have answered under it." : ""}
            </p>
          </div>
        </Panel>

        <Panel title="Questions" as="h2">
          {locked && (
            <p className="mb-3 flex items-start gap-1.5 rounded-control bg-muted/50 p-2 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              People have answered, so questions, answer types and options are fixed (answers point at them). You can still fix wording.
              Delete the answers to change the rest.
            </p>
          )}
          {!locked && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => suggest.mutate()} disabled={suggest.isPending || draft.questions.length >= 12}>
                <Sparkles aria-hidden /> {suggest.isPending ? "Writing…" : "Suggest questions from my assumptions"}
              </Button>
            </div>
          )}
          {suggest.isError && (
            <p role="alert" className="mb-3 text-sm text-destructive-text">
              {suggest.error instanceof ApiError ? suggest.error.message : "Couldn't get suggestions."}
            </p>
          )}
          {suggest.isSuccess && offered.length > 0 && (
            <div className="mb-4 rounded-control bg-ai/[0.06] p-3 text-sm">
              <AiLabel>AI suggestion: edit before publishing</AiLabel>
              <p className="mt-1 text-muted-foreground">
                One neutral question per assumption, about what people do today rather than whether they&apos;d buy. Check each one reads
                fairly.
              </p>
              <ul className="mt-2 flex flex-col divide-y divide-border">
                {offered.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{q.prompt}</span> <span className="text-xs text-muted-foreground">({QUESTION_LABELS[q.type]})</span>
                      {assumptionText(q.assumption_id) && <span className="block text-xs text-muted-foreground">Tests: &ldquo;{assumptionText(q.assumption_id)}&rdquo;</span>}
                    </span>
                    <span className="flex gap-1">
                      <Button variant="outline" className="min-h-11" disabled={room <= 0} onClick={() => addSuggested([q])}>
                        Use<span className="sr-only">: {q.prompt}</span>
                      </Button>
                      <Button variant="ghost" className="min-h-11" onClick={() => setOffered((o) => o.filter((x) => x !== q))}>
                        Dismiss<span className="sr-only">: {q.prompt}</span>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button className="min-h-11" disabled={room <= 0} onClick={() => addSuggested(offered)}>
                  Use all
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setOffered([])}>
                  Dismiss all
                </Button>
                {offered.length > room && (
                  <p className="text-xs text-muted-foreground">
                    A survey has at most 12 questions: {room > 0 ? `only ${room} more fit` : "remove one to add more"}.
                  </p>
                )}
              </div>
            </div>
          )}
          {draft.questions.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No questions yet. Keep it short: three to six questions get more answers.</p>}
          <ol className="flex flex-col gap-3">
            {draft.questions.map((q, i) => (
              <li key={q.id} className="rounded-control border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>
                      Question {i + 1} <span className="font-normal text-muted-foreground">· {QUESTION_LABELS[q.type]}</span>
                    </span>
                    {aiIds.has(q.id) && <AISuggestedBadge />}
                  </h3>
                  {!locked && (
                    <span className="flex gap-1">
                      <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ questions: moveItem(draft.questions, i, i - 1) })} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ questions: moveItem(draft.questions, i, i + 1) })} disabled={i === draft.questions.length - 1} aria-label={`Move question ${i + 1} down`}>
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ questions: draft.questions.filter((_, j) => j !== i) })} aria-label={`Remove question ${i + 1}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  )}
                </div>
                <QuestionFields question={q} onChange={(nq) => setQuestion(i, nq)} assumptions={openAssumptions} locked={locked} />
              </li>
            ))}
          </ol>
          {!locked && draft.questions.length < 12 && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={ids.add} className="text-xs">
                  Add a question
                </Label>
                <select id={ids.add} className="h-11 rounded-control border border-input bg-background px-3 text-sm" value={addType} onChange={(e) => setAddType(e.target.value as QuestionType)}>
                  {(Object.keys(QUESTION_LABELS) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" className="min-h-11" onClick={() => edit({ questions: [...draft.questions, emptyQuestion(addType, nextQuestionId(draft.questions))] })}>
                Add
              </Button>
            </div>
          )}
          {structureChanged && (
            <p role="alert" className="mt-3 text-sm text-destructive-text">
              These changes would no longer match the stored answers and can&apos;t be saved.
            </p>
          )}
        </Panel>

        <div className="sticky bottom-16 z-10 md:bottom-4 flex flex-wrap items-center gap-2 rounded-card border border-border bg-card p-3 shadow-sm">
          <Button className="min-h-11" onClick={() => save.mutate()} disabled={!dirty || save.isPending || structureChanged}>
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          {survey.status === "published" ? (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => state.mutate("close")} disabled={state.isPending}>
                Close survey
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => state.mutate("unpublish")} disabled={state.isPending}>
                Unpublish
              </Button>
            </>
          ) : survey.status === "closed" ? (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => state.mutate("publish")} disabled={state.isPending}>
                Reopen
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => state.mutate("unpublish")} disabled={state.isPending}>
                Unpublish
              </Button>
            </>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => state.mutate("publish")} disabled={state.isPending || structureChanged}>
              {state.isPending ? "Publishing…" : dirty ? "Save and publish" : "Publish"}
            </Button>
          )}
          {survey.url && safeHref(survey.url) && (
            <a href={safeHref(survey.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
              Open live survey <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <span className="ml-auto">
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Delete the survey and its answers?
                <Button variant="destructive" className="min-h-11" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  Delete
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDelete(true)}>
                Delete survey…
              </Button>
            )}
          </span>
          {(save.isError || state.isError || remove.isError) && (
            <ul role="alert" className="w-full list-disc pl-5 text-sm text-destructive-text">
              {errorList(save.error ?? state.error ?? remove.error).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <p role="status" className="w-full text-sm text-muted-foreground empty:hidden">
            {statusNote}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <section aria-labelledby="survey-preview-h">
          <h2 id="survey-preview-h" className="mb-2 font-semibold">
            Preview
          </h2>
          <SurveyPreview draft={draft} consent={survey.consent_preview} />
          {dirty && <p className="mt-1 text-xs text-muted-foreground">The consent text updates when you save.</p>}
        </section>
        <Results projectId={projectId} surveyId={survey.id} assumptions={assumptions.data ?? []} />
        <Answers projectId={projectId} survey={survey} />
      </div>
    </div>
  );
}

export function SurveyEditor({ projectId, surveyId }: { projectId: string; surveyId: number }) {
  const survey = useLabSurvey(projectId, surveyId);
  if (survey.isError && survey.error instanceof ApiError && survey.error.status === 404) {
    return <EmptyState title="Survey not found" body="It may have been deleted, or it belongs to another account." actionHref={`/projects/${projectId}/lab`} actionLabel="Validation Lab" />;
  }
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href={`/projects/${projectId}/lab`} className="inline-flex min-h-11 items-center hover:text-foreground">
              Validation Lab
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
            {survey.data?.title ?? "Survey"}
          </li>
        </ol>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{survey.data?.title ?? "Survey"}</h1>
      {survey.isPending ? (
        <Skeleton className="h-96" aria-busy="true" />
      ) : survey.isError ? (
        <ErrorState title="Couldn't load the survey" onRetry={() => survey.refetch()} />
      ) : (
        <Editor key={survey.data.id} projectId={projectId} survey={survey.data} />
      )}
    </div>
  );
}
