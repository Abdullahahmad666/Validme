"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { BarList } from "@/components/charts/BarList";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ChannelCard } from "@/components/report/DistributionSections";
import { AiLabel, Cited, Panel } from "@/components/report/parts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { STATUS_TEXT, figure, sparkSegments, trendText, usd } from "@/lib/distribution";
import { cn, safeHref } from "@/lib/utils";
import { api, ApiError } from "@/services/api";
import type { Distribution, KeywordRow, LastCheck, YouTubeChannelRow } from "@/types/distribution";

const YOUTUBE_TERMS = "https://www.youtube.com/t/terms";

function CheckLine({ check, connected, label }: { check: LastCheck; connected: boolean; label: string }) {
  if (!connected) return <p className="text-sm text-muted-foreground">{label} isn&apos;t connected yet, so this is unavailable.</p>;
  if (!check) return <p className="text-sm text-muted-foreground">Not looked up yet.</p>;
  return (
    <p className={cn("text-xs", check.status === "FAILED" ? "text-destructive-text" : "text-muted-foreground")}>
      {STATUS_TEXT[check.status]} {fmtDate(check.at)}
      {check.note ? ` · ${check.note}` : ""}
    </p>
  );
}

function YouTubeCard({ c, searches }: { c: YouTubeChannelRow; searches: number }) {
  const subscribers = c.subscriber_count !== null ? figure(c.subscriber_count) : c.subscribers_hidden ? "Hidden by the channel" : "Unavailable";
  const href = safeHref(c.url);
  const video = c.latest_video;
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
      <h3 className="break-words font-semibold">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="-my-1 inline-block py-1 hover:underline">
            {c.title}
            <span className="sr-only"> (YouTube channel, opens in a new tab)</span>
          </a>
        ) : (
          c.title
        )}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subscribers</dt>
        <dd className="tabular-nums">{subscribers}</dd>
        <dt className="text-muted-foreground">Videos</dt>
        <dd className="tabular-nums">{figure(c.video_count)}</dd>
      </dl>
      {video && (
        <p className="text-sm">
          <span className="text-muted-foreground">Latest matching video: </span>
          {safeHref(video.url) ? (
            <a href={safeHref(video.url)} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
              {video.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            video.title
          )}
          {video.published_at ? ` · ${fmtDate(video.published_at)}` : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        From YouTube, read {fmtDate(c.fetched_at)}. Deleted after {fmtDate(c.expires_at)}.
      </p>
      <p className="rounded-control bg-muted/50 px-2.5 py-1.5 text-xs">
        <span className="font-medium">Our searches:</span> found by {c.matched_queries.length}
        {searches > 0 ? ` of ${searches}` : ""} search{(searches || c.matched_queries.length) === 1 ? "" : "es"}
        {c.matched_queries.length > 0 ? ` (${c.matched_queries.map((q) => `“${q}”`).join(", ")})` : ""}. This is our search
        result, not a YouTube figure.
      </p>
    </li>
  );
}

function Spark({ k }: { k: KeywordRow }) {
  const segs = sparkSegments(k);
  if (!segs.length) return <span className="text-xs text-muted-foreground">No monthly figures</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 96 24" className="h-6 w-24" aria-hidden>
        {segs.map((p) => (
          <polyline key={p} points={p} fill="none" className="stroke-primary" strokeWidth={1.5} />
        ))}
      </svg>
      <span className="sr-only">{trendText(k)}</span>
    </span>
  );
}

function Keywords({ d }: { d: Distribution["keywords"] }) {
  return (
    <Panel
      title="Search demand"
      as="h2"
      aside={
        d.connected ? (
          <span className="text-xs text-muted-foreground">
            {d.allowance.used} of {d.allowance.limit} keyword look-ups used this month
          </span>
        ) : undefined
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Average monthly searches for your queries in {d.location.label} (English searches)
        {d.location.default ? ", used because your market isn't one we can map yet" : ""}. Figures from DataForSEO (Google
        Ads data), shown as the provider gives them.
      </p>
      <CheckLine check={d.last_check} connected={d.connected} label="Keyword data" />
      {d.connected && d.allowance.used >= d.allowance.limit && (
        <p className="mt-2 rounded-control bg-warning/10 p-2.5 text-sm text-warning-text">
          This month&apos;s keyword look-ups are used up.{" "}
          <Link href="/billing" className="font-medium underline">
            Founder and Pro plans include more
          </Link>
          .
        </p>
      )}
      {d.rows.some((r) => r.search_volume != null) && (
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold">Monthly searches, top keywords</h3>
          <BarList
            rows={d.rows
              .filter((r) => r.search_volume != null)
              .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))
              .slice(0, 8)
              .map((r) => ({ label: r.keyword, value: r.search_volume ?? 0 }))}
            unit="searches a month"
            labelWidth={240}
            additive={false}
          />
          {d.rows.some((r) => r.search_volume == null) && (
            <p className="text-xs text-muted-foreground">Keywords without a figure from the provider aren&apos;t drawn; they&apos;re in the table as unavailable.</p>
          )}
        </div>
      )}
      {d.rows.length > 0 && (
        <div
          className="relative mt-3 overflow-x-auto rounded-control focus-visible:outline-2 focus-visible:outline-ring"
          tabIndex={0}
          role="region"
          aria-label="Search demand table (scrolls sideways on small screens)"
        >
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Search demand per keyword</caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Keyword</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Avg. monthly searches</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Cost per click</th>
                <th scope="col" className="py-2 pr-3 font-medium">Ad competition</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">DataForSEO difficulty (0–100)</th>
                <th scope="col" className="py-2 pr-3 font-medium">Last 12 months</th>
                <th scope="col" className="py-2 font-medium">Read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.rows.map((k) => (
                <tr key={k.keyword}>
                  <th scope="row" className="py-2 pr-3 font-normal">{k.keyword}</th>
                  <td className="py-2 pr-3 text-right tabular-nums">{figure(k.search_volume)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{usd(k.cpc)}</td>
                  <td className="py-2 pr-3 capitalize">{k.competition ? k.competition.toLowerCase() : "Unavailable"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{figure(k.difficulty)}</td>
                  <td className="py-2 pr-3">
                    <Spark k={k} />
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {fmtDate(k.fetched_at)}
                    {k.stale && <span className="block text-warning-text">Over 30 days old</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d.connected && d.rows.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">No keywords looked up yet. Short queries work best; long sentences have no search data.</p>
      )}
    </Panel>
  );
}

export function CustomersView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const project = useProject(projectId);
  const data = useQuery({ queryKey: ["distribution", projectId], queryFn: () => api.distribution(projectId) });
  const keywordsLeft = !data.data || !data.data.keywords.connected || data.data.keywords.allowance.used < data.data.keywords.allowance.limit;
  const refresh = useMutation({
    // Without keyword allowance left, only YouTube is looked up.
    mutationFn: () => api.refreshDistribution(projectId, keywordsLeft ? ["youtube", "keywords"] : ["youtube"]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution", projectId] }),
  });

  if (project.isError && project.error instanceof ApiError && project.error.status === 404) {
    return <EmptyState title="Project not found" body="It may have been deleted, or it belongs to another account." actionHref="/projects" actionLabel="My projects" />;
  }
  const d = data.data;
  const researched = d?.channels.filter((c) => !c.is_hypothesis) ?? [];
  const hypotheses = d?.channels.filter((c) => c.is_hypothesis) ?? [];
  const searches = d?.youtube.searches.length ?? 0;
  const canLookUp = !!d && !!d.report && (d.youtube.connected || d.keywords.connected);
  const whyDisabled = !d
    ? ""
    : !d.report
      ? "Run research on this idea first: look-ups use its queries."
      : !d.youtube.connected && !d.keywords.connected
        ? "YouTube and keyword data aren't connected yet."
        : "";

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href="/projects" className="hover:text-foreground">
              My projects
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <Link href={`/projects/${projectId}/report`} title={project.data?.name} className="max-w-[14rem] truncate hover:text-foreground">
              {project.data?.name ?? "Project"}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            Where to find your customers
          </li>
        </ol>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Where to find your customers</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Places your audience already talks about the problem, YouTube channels they watch, and how many people search
            for it. Every figure says where it came from and when we read it. Nothing here contacts anyone for you.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || !canLookUp}
          aria-describedby="lookup-hint"
        >
          <RefreshCw className={cn(refresh.isPending && "animate-spin")} aria-hidden />
          {refresh.isPending ? "Looking up…" : "Look up YouTube and search demand"}
        </Button>
      </header>
      <p id="lookup-hint" className="-mt-3 text-xs text-muted-foreground">
        {whyDisabled ||
          "Uses your research queries. YouTube is checked at most every 6 hours; keyword look-ups count towards your monthly allowance. No credits are used."}
      </p>
      <div role="status">
        {refresh.isSuccess && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {refresh.data.youtube && (
            <li>
              YouTube: {STATUS_TEXT[refresh.data.youtube.status].toLowerCase()}. {refresh.data.youtube.note}
            </li>
          )}
          {refresh.data.keywords && (
            <li>
              Search demand: {STATUS_TEXT[refresh.data.keywords.status].toLowerCase()}. {refresh.data.keywords.note}
            </li>
          )}
        </ul>
        )}
      </div>
      {refresh.isError && (
        <p role="alert" className="text-sm text-destructive-text">
          {refresh.error instanceof ApiError ? refresh.error.message : "Couldn't look up right now. Please try again."}
        </p>
      )}

      {data.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : data.isError || !d ? (
        <ErrorState title="Couldn't load this page" onRetry={() => data.refetch()} />
      ) : (
        <>
          <section aria-labelledby="talk-h">
            <h2 id="talk-h" className="mb-1 font-semibold">
              Where your audience already talks
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {d.report ? `From your report of ${fmtDate(d.report.created_at)}. ` : ""}
              <span className="font-medium text-success-text">Researched</span> means the evidence shows people discussing the problem there;{" "}
              <span className="font-medium text-warning-text">Hypothesis</span> means it wasn&apos;t searched.
            </p>
            {!d.report ? (
              <EmptyState
                title="No research yet"
                body="Run research on this idea to see where people discuss the problem."
                actionHref={`/research/new?project=${projectId}`}
                actionLabel="Start research"
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[...researched, ...hypotheses].map((c) => (
                  <ChannelCard key={c.key} c={c} index={d.evidence} />
                ))}
              </ul>
            )}
          </section>

          <Panel
            title="YouTube channels"
            as="h2"
            aside={
              <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                Data from YouTube ·{" "}
                <a href={YOUTUBE_TERMS} target="_blank" rel="noopener noreferrer" className="-my-1 inline-block py-1 underline">
                  YouTube Terms of Service<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </span>
            }
          >
            <p className="mb-2 text-sm text-muted-foreground">
              Channels with recent videos matching your searches. Size (subscribers), activity (latest matching video) and
              relevance (our searches) are shown separately; we don&apos;t combine them into a score.
            </p>
            <CheckLine check={d.youtube.last_check} connected={d.youtube.connected} label="YouTube" />
            {d.youtube.channels.length > 0 ? (
              <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.youtube.channels.map((c) => (
                  <YouTubeCard key={c.channel_id} c={c} searches={searches} />
                ))}
              </ul>
            ) : (
              d.youtube.connected && <p className="mt-2 text-sm text-muted-foreground">No channels stored. Look up to find some.</p>
            )}
          </Panel>

          <Keywords d={d.keywords} />

          <Panel title="Experiments for your first 10 customers" as="h2" aside={<span className="text-xs text-muted-foreground">You do the outreach: nothing is sent for you</span>}>
            {d.first_ten_plan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Run research to get a plan built from your evidence.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {d.first_ten_plan.map((s, i) => (
                  <li key={`${i}-${s.title}`} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {s.title}
                        {s.ai && <AiLabel>Uses AI themes</AiLabel>}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                      {s.evidence_ids.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sm font-medium text-primary">Cited threads</summary>
                          <div className="mt-2">
                            <Cited ids={s.evidence_ids} index={d.evidence} max={3} />
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <p className="text-xs text-muted-foreground">
            <Search className="mr-1 inline size-3.5" aria-hidden />
            Sources: your research evidence, the YouTube Data API and DataForSEO. YouTube data is deleted within 30 days of reading it.{" "}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            {" · "}
            <a href={YOUTUBE_TERMS} target="_blank" rel="noopener noreferrer" className="underline">
              YouTube Terms<ExternalLink className="ml-0.5 inline size-3" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </>
      )}
    </div>
  );
}
