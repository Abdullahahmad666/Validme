"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Info, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { fieldA11y, FormField } from "@/components/auth/FormField";
import { InterpretationCard } from "@/components/research/InterpretationCard";
import { WizardActions } from "@/components/research/WizardActions";
import { useWizard } from "@/components/research/wizard-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/useAutosave";
import { projectsKey, summaryKey } from "@/hooks/useProjects";
import { projectKey, useInterpret } from "@/hooks/useResearch";
import { ideaSchema, OBJECTIVES, type IdeaForm } from "@/lib/validation";
import { autosavePatch } from "@/lib/wizard";
import { api, ApiError } from "@/services/api";
import { hasInterpretation, type Project } from "@/types/api";

function defaultsFrom(project: Project | null, idea: string | null): IdeaForm {
  return {
    name: project?.name ?? "",
    description: project?.description ?? (idea ?? "").slice(0, 2000),
    objectives: project?.objectives?.length ? project.objectives : ["validate_demand"],
    existing_product_url: project?.existing_product_url ?? "",
    additional_context: project?.additional_context ?? "",
  };
}

/** Step 1 — describe the idea. Creates the draft on first "Understand my idea"; autosaves after that. */
export function StepIdea({ onCreated }: { onCreated: (projectId: string) => void }) {
  const { project, goTo, reportSave } = useWizard();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [creating, setCreating] = useState(false);
  const interpret = useInterpret(project?.id ?? "");

  const form = useForm<IdeaForm>({
    resolver: zodResolver(ideaSchema),
    defaultValues: defaultsFrom(project, params.get("idea")),
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as IdeaForm;

  const autosave = useAutosave(
    project?.id ?? null,
    () => (project ? autosavePatch(1, values, project) : {}),
    [values.name, values.description, values.existing_product_url, values.additional_context, values.objectives?.join()],
  );
  const { state: saveState, flush, retry } = autosave;
  useEffect(() => reportSave({ state: saveState, flush, retry }), [saveState, flush, retry, reportSave]);

  function applyServerErrors(err: unknown) {
    if (err instanceof ApiError && err.details) {
      for (const [field, msgs] of Object.entries(err.details)) {
        const message = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
        if (field in ideaSchema.shape) form.setError(field as keyof IdeaForm, { message });
      }
    }
  }

  async function runInterpretation(projectId: string) {
    setAiUnavailable(false);
    try {
      const { ai_interpretation } = await api.interpretProject(projectId);
      qc.setQueryData<Project>(projectKey(projectId), (p) => (p ? { ...p, ai_interpretation } : p));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 503 || err.status === 429)) {
        setAiUnavailable(true);
      } else {
        toast.error("We couldn't interpret your idea this time. You can try again or continue without it.");
      }
    }
  }

  // "Understand my idea": create the draft if needed, save, then ask the AI.
  const understand = form.handleSubmit(async (data) => {
    if (!project) {
      setCreating(true);
      try {
        const created = await api.createProject(data);
        qc.setQueryData(projectKey(created.id), created);
        qc.invalidateQueries({ queryKey: projectsKey });
        qc.invalidateQueries({ queryKey: summaryKey });
        await runInterpretation(created.id);
        onCreated(created.id);
      } catch (err) {
        applyServerErrors(err);
        toast.error(err instanceof ApiError ? err.message : "Couldn't save your draft. Please try again.");
      } finally {
        setCreating(false);
      }
      return;
    }
    await flush();
    await interpret.mutateAsync().catch((err) => {
      if (err instanceof ApiError && (err.status === 503 || err.status === 429)) setAiUnavailable(true);
      else toast.error("We couldn't interpret your idea this time. Try again or continue without it.");
    });
  });

  const next = form.handleSubmit(async (data) => {
    if (!project) {
      setCreating(true);
      try {
        const created = await api.createProject(data);
        qc.setQueryData(projectKey(created.id), created);
        qc.invalidateQueries({ queryKey: projectsKey });
        onCreated(created.id);
      } catch (err) {
        applyServerErrors(err);
        toast.error(err instanceof ApiError ? err.message : "Couldn't save your draft.");
      } finally {
        setCreating(false);
      }
      return;
    }
    await goTo(2);
  });

  async function confirm() {
    if (!project) return;
    try {
      const updated = await api.updateProject(project.id, { interpretation_confirmed: true });
      qc.setQueryData(projectKey(project.id), updated);
    } catch {
      toast.error("Couldn't save. Please try again.");
    }
  }

  const busy = creating || interpret.isPending;
  const interpretation = project && hasInterpretation(project) ? project.ai_interpretation : null;

  return (
    <div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Let&apos;s understand your idea.</h1>
      <p className="mt-2 text-muted-foreground">
        Tell us what you&apos;re thinking of building. It doesn&apos;t need to be perfectly defined.
      </p>

      <form onSubmit={(e) => e.preventDefault()} noValidate className="mt-6 flex flex-col gap-5">
        <FormField id="name" label="Project name" error={errors.name?.message}>
          <Input
            className="h-11"
            placeholder="e.g. Restaurant inventory tracker"
            {...fieldA11y("name", errors.name?.message)}
            {...form.register("name")}
          />
        </FormField>

        <FormField
          id="description"
          label="Idea description"
          error={errors.description?.message}
          hint={<span className="tabular-nums">{values.description?.length ?? 0} / 2,000</span>}
        >
          <Textarea
            rows={6}
            maxLength={2000}
            placeholder="Who has the problem, what you'd build, and why now."
            {...fieldA11y("description", errors.description?.message, true)}
            {...form.register("description")}
          />
        </FormField>

        <fieldset
          className="flex flex-col gap-2"
          aria-invalid={errors.objectives ? true : undefined}
          aria-describedby={errors.objectives ? "objectives-error" : undefined}
        >
          <legend className="mb-1.5 text-sm font-medium">Research objectives</legend>
          <Controller
            control={form.control}
            name="objectives"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map((o) => {
                  const selected = field.value.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        field.onChange(selected ? field.value.filter((v) => v !== o.value) : [...field.value, o.value])
                      }
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {selected && <Check size={14} aria-hidden />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.objectives && (
            <p id="objectives-error" className="text-sm text-destructive">
              {errors.objectives.message}
            </p>
          )}
        </fieldset>

        <FormField id="existing_product_url" label="Existing product URL (optional)" error={errors.existing_product_url?.message}>
          <Input
            type="url"
            inputMode="url"
            className="h-11"
            placeholder="https://"
            {...fieldA11y("existing_product_url", errors.existing_product_url?.message)}
            {...form.register("existing_product_url")}
          />
        </FormField>

        <FormField
          id="additional_context"
          label="Additional context (optional)"
          error={errors.additional_context?.message}
          hint={<span className="tabular-nums">{values.additional_context?.length ?? 0} / 1,000</span>}
        >
          <Textarea
            rows={3}
            maxLength={1000}
            {...fieldA11y("additional_context", errors.additional_context?.message, true)}
            {...form.register("additional_context")}
          />
        </FormField>
      </form>

      <div className="mt-6 flex flex-col gap-4">
        {!interpretation && (
          <Button type="button" variant="outline" size="lg" className="self-start" onClick={understand} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden className="text-ai" />}
            Understand my idea
          </Button>
        )}
        {aiUnavailable && (
          <Alert>
            <Info aria-hidden />
            <AlertDescription>
              AI assistance isn&apos;t available right now. You can continue and describe your market yourself.
            </AlertDescription>
          </Alert>
        )}
        {interpretation && project && (
          <InterpretationCard
            interpretation={interpretation}
            confirmed={project.interpretation_confirmed}
            onConfirm={confirm}
            onRetry={understand}
            retrying={interpret.isPending}
          />
        )}
      </div>

      <WizardActions>
        <p className="text-xs text-muted-foreground">Drafts are free and never use credits.</p>
        <Button type="button" size="lg" onClick={next} disabled={busy}>
          {creating && <Loader2 className="animate-spin" aria-hidden />}
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </WizardActions>
    </div>
  );
}
