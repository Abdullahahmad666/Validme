"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { QueryEditor } from "@/components/research/QueryEditor";
import { isUsable, SourcePicker } from "@/components/research/SourcePicker";
import { WizardActions } from "@/components/research/WizardActions";
import { useWizard } from "@/components/research/wizard-context";
import { ChipsInput } from "@/components/shared/ChipsInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/hooks/useAutosave";
import { useMe } from "@/hooks/useSession";
import { useSources } from "@/hooks/useResearch";
import { autosavePatch, COMPETITOR_ASPECTS, DEPTHS, stepSchemas } from "@/lib/wizard";
import { cn } from "@/lib/utils";

type ConfigForm = z.infer<(typeof stepSchemas)[3]>;
const httpUrl = z.url({ protocol: /^https?$/ });
const checkUrl = (v: string) => (httpUrl.safeParse(v).success ? null : "Use a full http:// or https:// URL.");

function Section({ letter, title, body, children }: { letter: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${letter}`} className="flex flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 id={`section-${letter}`} className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {letter}
          </span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </section>
  );
}

export function StepConfigure() {
  const { project: maybeProject, goTo, reportSave } = useWizard();
  const project = maybeProject!;
  const sources = useSources();
  const me = useMe();

  const form = useForm<ConfigForm>({
    resolver: zodResolver(stepSchemas[3]),
    defaultValues: {
      sources: project.sources,
      depth: project.depth,
      competitor_discovery: project.competitor_discovery,
      competitor_urls: project.competitor_urls,
      evidence_urls: project.evidence_urls,
      competitor_aspects: project.competitor_aspects.length ? project.competitor_aspects : ["features", "pricing", "complaints", "gaps"],
      exclude_terms: project.exclude_terms,
    },
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as ConfigForm;

  // First visit: select every source that can actually run.
  useEffect(() => {
    if (sources.data && project.sources.length === 0 && form.getValues("sources").length === 0) {
      form.setValue("sources", sources.data.results.filter(isUsable).map((s) => s.key), { shouldDirty: true });
    }
  }, [sources.data, project.sources.length, form]);

  const autosave = useAutosave(project.id, () => autosavePatch(3, values, project), [JSON.stringify(values)]);
  const { state: saveState, flush, retry } = autosave;
  useEffect(() => reportSave({ state: saveState, flush, retry }), [saveState, flush, retry, reportSave]);

  const next = form.handleSubmit(() => goTo(4));

  return (
    <div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Configure your research.</h1>
      <p className="mt-2 text-muted-foreground">Choose where to look, what to search for, and how deep to go.</p>

      <form onSubmit={(e) => e.preventDefault()} noValidate className="mt-8 flex flex-col gap-8">
        <Section letter="A" title="Sources" body="Every report lists exactly which sources ran and which didn't.">
          <Controller
            control={form.control}
            name="sources"
            render={({ field }) => <SourcePicker value={field.value} onChange={field.onChange} invalid={!!errors.sources} />}
          />
          {errors.sources && <p className="text-sm text-destructive">{errors.sources.message}</p>}
        </Section>

        <Section letter="B" title="Search queries" body="Grouped by what each query is trying to find.">
          <QueryEditor projectId={project.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exclude_terms">Exclude results mentioning (optional)</Label>
            <Controller
              control={form.control}
              name="exclude_terms"
              render={({ field }) => (
                <ChipsInput id="exclude_terms" value={field.value} onChange={field.onChange} max={20} maxLength={40} placeholder="e.g. jobs, hiring" />
              )}
            />
          </div>
        </Section>

        <Section letter="C" title="Competitors and your own links" body="Add pages you already know about. We read each one once and keep the date.">
          <Controller
            control={form.control}
            name="competitor_discovery"
            render={({ field }) => (
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-[var(--primary)]"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">Find competitors automatically</span>
                  <span className="block text-xs text-muted-foreground">
                    From search results. Full competitor profiles arrive with the competitor analysis release.
                  </span>
                </span>
              </label>
            )}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="competitor_urls">Competitor websites (up to 10)</Label>
            <Controller
              control={form.control}
              name="competitor_urls"
              render={({ field }) => (
                <ChipsInput id="competitor_urls" value={field.value} onChange={field.onChange} max={10} maxLength={500} inputMode="url" placeholder="https://competitor.com/pricing" validate={checkUrl} />
              )}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">What to look at on competitor pages</legend>
            <Controller
              control={form.control}
              name="competitor_aspects"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {COMPETITOR_ASPECTS.map((a) => {
                    const on = field.value.includes(a.value);
                    return (
                      <button
                        key={a.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(on ? field.value.filter((v) => v !== a.value) : [...field.value, a.value])}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm",
                          on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border hover:bg-muted",
                        )}
                      >
                        {on && <Check className="size-3.5" aria-hidden />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evidence_urls">Threads, reviews or articles you found (up to 10)</Label>
            <Controller
              control={form.control}
              name="evidence_urls"
              render={({ field }) => (
                <ChipsInput id="evidence_urls" value={field.value} onChange={field.onChange} max={10} maxLength={500} inputMode="url" placeholder="https://…" validate={checkUrl} />
              )}
            />
          </div>
        </Section>

        <Section letter="D" title="Depth" body="Depth sets a hard budget of queries and results. Credits are charged once, at launch.">
          <Controller
            control={form.control}
            name="depth"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Research depth" className="grid gap-2 sm:grid-cols-3">
                {DEPTHS.map((d) => {
                  const selected = field.value === d.value;
                  // Mirrors the server's plan limit (enforced again at launch).
                  const locked = !!me.data && !me.data.allowed_depths.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={locked}
                      onClick={() => !locked && field.onChange(d.value)}
                      className={cn(
                        "relative flex flex-col items-start rounded-card border p-4 text-left transition-colors",
                        selected ? "border-primary bg-primary/[0.05]" : "border-border hover:bg-muted",
                        locked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                      )}
                    >
                      {d.recommended && (
                        <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          Recommended
                        </span>
                      )}
                      <span className={cn("font-semibold", selected && "text-primary")}>{d.label}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {d.credits} credit{d.credits > 1 ? "s" : ""}
                      </span>
                      <span className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.body}</span>
                      {locked && <span className="mt-2 text-xs font-medium text-primary">Unlocked by a plan or any credit pack</span>}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Section>
      </form>

      <WizardActions>
        <Button type="button" variant="ghost" onClick={() => goTo(2)}>
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <Button type="button" size="lg" onClick={next}>
          Review
          <ArrowRight aria-hidden />
        </Button>
      </WizardActions>
    </div>
  );
}
