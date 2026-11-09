"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { fieldA11y, FormField } from "@/components/auth/FormField";
import { InterpretationCard } from "@/components/research/InterpretationCard";
import { WizardActions } from "@/components/research/WizardActions";
import { useWizard } from "@/components/research/wizard-context";
import { AISuggestedBadge } from "@/components/shared/AISuggestedBadge";
import { ChipsInput } from "@/components/shared/ChipsInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/useAutosave";
import { autosavePatch, BUSINESS_STAGES, COMMON_GEOGRAPHIES, stepSchemas, withoutAiFlags } from "@/lib/wizard";
import { cn } from "@/lib/utils";
import { hasInterpretation, type AISuggestedField, type CustomerType, type Project } from "@/types/api";

type MarketForm = z.infer<(typeof stepSchemas)[2]>;
const CUSTOMER_TYPES: { value: CustomerType; label: string; hint: string }[] = [
  { value: "B2B", label: "B2B", hint: "Businesses buy it" },
  { value: "B2C", label: "B2C", hint: "Consumers buy it" },
  { value: "B2B2C", label: "B2B2C", hint: "Sold via businesses to consumers" },
];

/** On first visit, empty market fields are pre-filled from the AI interpretation and flagged. */
function initialMarket(project: Project): { values: MarketForm; flags: AISuggestedField[] } {
  const values: MarketForm = {
    industry: project.industry,
    customer_type: project.customer_type,
    audiences: project.audiences,
    geographies: project.geographies,
    business_stage: project.business_stage,
    current_alternatives: project.current_alternatives,
    price_hypothesis: project.price_hypothesis,
  };
  const flags = [...project.ai_suggested_fields];
  const untouched = !values.industry && !values.customer_type && !values.audiences.length && !values.geographies.length;
  if (untouched && flags.length === 0 && hasInterpretation(project)) {
    const ai = project.ai_interpretation;
    if (ai.industry) {
      values.industry = ai.industry;
      flags.push("industry");
    }
    if (ai.customer_type) {
      values.customer_type = ai.customer_type;
      flags.push("customer_type");
    }
    const audiences = ai.suggested_audiences.length ? ai.suggested_audiences : ai.target_customers;
    if (audiences.length) {
      values.audiences = audiences.slice(0, 10);
      flags.push("audiences");
    }
    if (ai.suggested_geographies.length) {
      values.geographies = ai.suggested_geographies.slice(0, 20);
      flags.push("geographies");
    }
  }
  return { values, flags };
}

export function StepMarket() {
  const { project: maybeProject, goTo, reportSave } = useWizard();
  const project = maybeProject!;
  const [initial] = useState(() => initialMarket(project));
  const [aiFlags, setAiFlags] = useState<AISuggestedField[]>(initial.flags);

  const form = useForm<MarketForm>({ resolver: zodResolver(stepSchemas[2]), defaultValues: initial.values });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as MarketForm;

  // Editing an AI-suggested field makes it the founder's own.
  const own = (field: AISuggestedField) => setAiFlags((f) => withoutAiFlags(f, [field]));

  const autosave = useAutosave(
    project.id,
    () => {
      const patch = autosavePatch(2, values, project);
      return JSON.stringify(aiFlags) === JSON.stringify(project.ai_suggested_fields) ? patch : { ...patch, ai_suggested_fields: aiFlags };
    },
    [JSON.stringify(values), aiFlags.join()],
  );
  const { state: saveState, flush, retry } = autosave;
  useEffect(() => reportSave({ state: saveState, flush, retry }), [saveState, flush, retry, reportSave]);

  const next = form.handleSubmit(() => goTo(3));
  const interpretation = hasInterpretation(project) ? project.ai_interpretation : null;
  const label = (field: AISuggestedField, text: string, htmlFor?: string) => (
    <span className="flex items-center gap-2">
      {htmlFor ? <Label htmlFor={htmlFor}>{text}</Label> : <span className="text-sm font-medium">{text}</span>}
      {aiFlags.includes(field) && <AISuggestedBadge />}
    </span>
  );
  const reg = (name: FieldPath<MarketForm>, flag?: AISuggestedField) =>
    form.register(name, { onChange: flag ? () => own(flag) : undefined });

  return (
    <div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Define your market.</h1>
      <p className="mt-2 text-muted-foreground">Who would buy this, and where? The sharper this is, the sharper the evidence.</p>

      {interpretation && (
        <div className="mt-6">
          <InterpretationCard interpretation={interpretation} confirmed={project.interpretation_confirmed} compact />
          <Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={() => goTo(1)}>
            <Pencil aria-hidden />
            Edit idea
          </Button>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} noValidate className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          {label("industry", "Industry", "industry")}
          <Input className="h-11" placeholder="e.g. Food service" {...fieldA11y("industry", errors.industry?.message)} {...reg("industry", "industry")} />
          {errors.industry && <p className="text-sm text-destructive">{errors.industry.message}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5">{label("customer_type", "Customer type")}</legend>
          <Controller
            control={form.control}
            name="customer_type"
            render={({ field }) => (
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                {CUSTOMER_TYPES.map((c) => {
                  const selected = field.value === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        field.onChange(c.value);
                        own("customer_type");
                      }}
                      className={cn(
                        "flex min-h-14 flex-col items-start justify-center rounded-control border px-4 py-2 text-left transition-colors",
                        selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className={cn("text-sm font-semibold", selected && "text-primary")}>{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.hint}</span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </fieldset>

        <div className="flex flex-col gap-1.5">
          {label("audiences", "Audience segments", "audiences")}
          <p id="audiences-hint" className="text-xs text-muted-foreground">
            Concrete groups, e.g. “single-location restaurant owners”. At least one.
          </p>
          <Controller
            control={form.control}
            name="audiences"
            render={({ field }) => (
              <ChipsInput
                id="audiences"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  own("audiences");
                }}
                max={10}
                placeholder="Add a segment"
                describedBy="audiences-hint"
                invalid={!!errors.audiences}
                suggestions={interpretation?.target_customers ?? []}
              />
            )}
          />
          {errors.audiences && <p className="text-sm text-destructive">{errors.audiences.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          {label("geographies", "Geography", "geographies")}
          <Controller
            control={form.control}
            name="geographies"
            render={({ field }) => (
              <ChipsInput
                id="geographies"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  own("geographies");
                }}
                max={20}
                maxLength={80}
                placeholder="Type or pick a country or region"
                suggestions={COMMON_GEOGRAPHIES}
              />
            )}
          />
        </div>

        <FormField id="business_stage" label="Business stage">
          <select
            id="business_stage"
            className="h-11 rounded-control border border-input bg-transparent px-3 text-sm"
            {...form.register("business_stage")}
          >
            <option value="">Choose…</option>
            {BUSINESS_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="current_alternatives"
          label="What do customers use today? (optional)"
          error={errors.current_alternatives?.message}
        >
          <Textarea
            rows={3}
            maxLength={1000}
            placeholder="Spreadsheets, a POS add-on, nothing at all…"
            {...fieldA11y("current_alternatives", errors.current_alternatives?.message)}
            {...form.register("current_alternatives")}
          />
        </FormField>

        <FormField
          id="price_hypothesis"
          label="Price you have in mind (optional)"
          error={errors.price_hypothesis?.message}
          hint="Your assumption. Research will look for evidence for or against it."
        >
          <Input
            className="h-11"
            maxLength={120}
            placeholder="e.g. $29/month"
            {...fieldA11y("price_hypothesis", errors.price_hypothesis?.message, true)}
            {...form.register("price_hypothesis")}
          />
        </FormField>
      </form>

      <WizardActions>
        <Button type="button" variant="ghost" onClick={() => goTo(1)}>
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <Button type="button" size="lg" onClick={next}>
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </WizardActions>
    </div>
  );
}
