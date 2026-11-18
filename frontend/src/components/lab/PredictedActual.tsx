"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, SearchCheck } from "lucide-react";
import Link from "next/link";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ExperimentVerdict } from "@/components/lab/ExperimentVerdict";
import { Panel } from "@/components/report/parts";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { labKeys } from "@/hooks/useLab";
import { pct } from "@/lib/lab";
import { api } from "@/services/api";
import type { ExperimentResult, PredictedActual as Data } from "@/types/report";

const STATUS_WORDS = { untested: "Untested", supported: "Supported", contradicted: "Contradicted" } as const;
const whoSet = (locked: boolean, auto: string) => (locked ? "set by you" : auto === "inconclusive" ? "waiting for a clear survey result" : "from your survey");

function Actual({ e }: { e: ExperimentResult | null }) {
  if (!e) return <span className="text-muted-foreground">No result yet</span>;
  if (!e.counted) {
    return (
      <span className="text-muted-foreground">
        {e.successes} {e.label} from {e.trials} views: too few to count yet (needs 30)
      </span>
    );
  }
  return (
    <span>
      <span className="font-semibold tabular-nums">{e.score}/100</span>{" "}
      <span className="text-muted-foreground">
        · {e.successes} {e.label} from {e.trials} views ({pct(e.rate, 1)}; likely at least {pct(e.low, 1)}, 95% range)
        {e.excluded_days && e.excluded_days.length > 0 && ` · ${e.excluded_days.length} unusual day(s) left out`}
      </span>
    </span>
  );
}

/** What research predicted next to what the founder's own experiments show (Week 15). Numbers come from the server. */
export function PredictedActualView({ data, projectId }: { data: Data; projectId: string }) {
  const nothingLive = data.live_pages === 0 && data.live_surveys === 0;
  const tested = data.assumptions.filter((a) => a.auto_status);
  const untested = data.assumptions.length - tested.length;
  return (
    <Panel
      title="Predicted vs actual"
      as="h2"
      aside={<span className="text-xs text-muted-foreground">What real people did outweighs what research predicted</span>}
    >
      {nothingLive && (
        <p className="mb-3 text-sm text-muted-foreground">
          Once a test page or survey has been live, what real people did shows up here next to what the research predicted.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <caption className="sr-only">Research prediction and your experiment result for each score dimension</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">
                <span className="sr-only">Score dimension</span>
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                <SearchCheck className="mr-1 inline size-3.5" aria-hidden />
                Research predicted
              </th>
              <th scope="col" className="py-1 font-medium">
                <FlaskConical className="mr-1 inline size-3.5" aria-hidden />
                Your experiment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.dimensions.map((d) => (
              <tr key={d.key} className="align-top">
                <th scope="row" className="py-2 pr-2 font-semibold">
                  {d.label}
                </th>
                <td className="py-2 pr-2">
                  {d.predicted === null ? (
                    <span className="text-muted-foreground">No report yet</span>
                  ) : d.predicted.score === null ? (
                    <span className="text-muted-foreground">Not scored</span>
                  ) : (
                    <span>
                      <span className="font-semibold tabular-nums">{d.predicted.score}/100</span>{" "}
                      <span className="text-muted-foreground">· {d.predicted.confidence} confidence</span>
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <Actual e={d.actual} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {data.report ? `Prediction from your report of ${fmtDate(data.report.created_at)}. ` : ""}
        {data.rules} New reports and the weekly re-check include your experiments in the score.
      </p>

      <h3 className="mt-5 text-sm font-semibold">Your assumptions</h3>
      {data.assumptions.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          No assumptions yet. Add them on your report&apos;s{" "}
          <Link href={`/projects/${projectId}/report?tab=market-gaps`} className="font-medium underline">
            Market gaps tab
          </Link>
          , then link survey questions to them.
        </p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col gap-3">
            {tested.map((a) => (
              <li key={a.id} className="rounded-control border border-border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 font-medium">
                  {a.text}
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">
                    Status: {STATUS_WORDS[a.status]} ({whoSet(a.status_locked, a.auto_status)})
                  </span>
                </p>
                <ExperimentVerdict a={a} className="mt-2" />
              </li>
            ))}
          </ul>
          {untested > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {untested} assumption{untested === 1 ? " isn't" : "s aren't"} tested by a survey yet: link a survey question to
              {untested === 1 ? " it" : " them"} and choose which answers support {untested === 1 ? "it" : "them"}.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

export function PredictedActual({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: labKeys.predictedVsActual(projectId), queryFn: () => api.predictedVsActual(projectId) });
  if (q.isPending) return <Skeleton className="h-48" aria-busy="true" />;
  if (q.isError) return <ErrorState title="Couldn't load predicted vs actual" onRetry={() => q.refetch()} />;
  return <PredictedActualView data={q.data} projectId={projectId} />;
}
