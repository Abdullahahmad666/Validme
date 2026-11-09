import { FlaskConical, MapPin, Users } from "lucide-react";
import { CATEGORY_META, fmtDate } from "@/components/evidence/EvidenceCard";
import { AiLabel, Cited, EvidenceQuote, Panel } from "@/components/report/parts";
import { cn } from "@/lib/utils";
import type { EvidenceCategory } from "@/types/api";
import type { Channel, Report } from "@/types/report";

function Signals({ counts }: { counts: Partial<Record<EvidenceCategory, number>> }) {
  const entries = Object.entries(counts) as [EvidenceCategory, number][];
  if (!entries.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => (
          <li key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-strong">
            {CATEGORY_META[c]?.label ?? c} {n}
          </li>
        ))}
    </ul>
  );
}

export function Audience({ r }: { r: Report }) {
  const segments = r.audience?.segments;
  if (!segments) {
    return (
      <Panel title="Audience segments">
        <p className="text-sm text-muted-foreground">This report was built before audience analysis existed. Re-run the research to add it.</p>
      </Panel>
    );
  }
  if (segments.length === 0) {
    return (
      <Panel title="Audience segments">
        <p className="text-sm text-muted-foreground">No audience segments were set for this project. Add them in the research setup, then re-run.</p>
      </Panel>
    );
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {segments.map((s) => (
        <li key={s.name} className="flex flex-col gap-3 rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-primary" aria-hidden />
              {s.name}
            </h3>
            <span className="text-xs text-muted-foreground">{s.source === "founder" ? "Your segment" : "AI suggested"}</span>
          </div>
          <p className="text-sm">{s.accessibility}</p>
          <Signals counts={s.signals} />
          {s.channels.length > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Found on {s.channels.join(", ")}
            </p>
          )}
          <div>
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Needs {s.needs.length > 0 && <AiLabel>AI themes</AiLabel>}
            </p>
            {s.needs.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No themes link to this segment yet.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {s.needs.map((n) => (
                  <li key={n.text}>
                    {n.text} <span className="text-xs text-muted-foreground">({n.evidence_ids.length} records)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {s.evidence_ids.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">Show evidence</summary>
              <div className="mt-2">
                <Cited ids={s.evidence_ids} index={r.evidence_index} max={3} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChannelCard({ c, r }: { c: Channel; r: Report }) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold">{c.name}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            c.is_hypothesis ? "bg-warning/10 text-warning-text" : "bg-success/10 text-success-text",
          )}
        >
          {c.is_hypothesis && <FlaskConical className="size-3" aria-hidden />}
          {c.is_hypothesis ? "Hypothesis" : "Researched"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {c.is_hypothesis
          ? "Not searched: no supporting evidence"
          : `${c.evidence_count} record${c.evidence_count === 1 ? "" : "s"} · ${c.threads} thread${c.threads === 1 ? "" : "s"}${c.latest ? ` · latest ${fmtDate(c.latest)}` : ""}`}
      </p>
      <p className="text-sm leading-relaxed">{c.recommendation}</p>
      {!c.is_hypothesis && <Signals counts={c.categories} />}
      {c.evidence_ids.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary">Show evidence</summary>
          <div className="mt-2">
            <Cited ids={c.evidence_ids} index={r.evidence_index} max={3} />
          </div>
        </details>
      )}
    </li>
  );
}

export function Distribution({ r }: { r: Report }) {
  const d = r.distribution;
  if (!d) {
    return (
      <Panel title="Distribution">
        <p className="text-sm text-muted-foreground">This report was built before distribution analysis existed. Re-run the research to add it.</p>
      </Panel>
    );
  }
  const researched = d.channels.filter((c) => !c.is_hypothesis);
  const hypotheses = d.channels.filter((c) => c.is_hypothesis);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="channels-h">
        <h2 id="channels-h" className="mb-1 font-semibold">
          Channels
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          <span className="font-medium text-success-text">Researched</span> means the evidence shows people discussing the problem there.{" "}
          <span className="font-medium text-warning-text">Hypothesis</span> means it wasn&apos;t searched: test it before relying on it.
        </p>
        {researched.length === 0 && (
          <p className="mb-3 rounded-control border border-dashed border-border p-3 text-sm text-muted-foreground">
            No researched channels: none of the searched sources had classified evidence of your audience discussing the problem.
          </p>
        )}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...researched, ...hypotheses].map((c) => (
            <ChannelCard key={c.key} c={c} r={r} />
          ))}
        </ul>
      </section>

      <Panel title="Where to find your first 100 potential customers">
        {d.threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No threads yet. Start with the hypothesis channels and add the threads you find to your next research.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Threads where people described the problem. Read them before reaching out to anyone.</p>
            <ul className="grid gap-2 md:grid-cols-2">
              {d.threads.map((e) => (
                <EvidenceQuote key={e.id} e={e} />
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="First 10 customers plan" aside={<span className="text-xs text-muted-foreground">You do the outreach: nothing is sent for you</span>}>
        <ol className="flex flex-col gap-4">
          {d.first_ten_plan.map((s, i) => (
            <li key={s.title} className="flex gap-3">
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
                      <Cited ids={s.evidence_ids} index={r.evidence_index} max={3} />
                    </div>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
