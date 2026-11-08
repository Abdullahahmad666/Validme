"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { fieldA11y, FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/hooks/useProjects";
import { ideaSchema, OBJECTIVES, type IdeaForm } from "@/lib/validation";
import { ApiError } from "@/services/api";

/**
 * Wizard step 1: creates the draft project (drafts never consume credits).
 * Steps 2–4, AI interpretation and autosave land with the full wizard.
 */
export function IdeaStepForm() {
  const router = useRouter();
  const params = useSearchParams();
  const create = useCreateProject();
  const form = useForm<IdeaForm>({
    resolver: zodResolver(ideaSchema),
    defaultValues: {
      name: "",
      description: (params.get("idea") ?? "").slice(0, 2000),
      objectives: ["validate_demand"],
      existing_product_url: "",
      additional_context: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const description = useWatch({ control: form.control, name: "description" });
  const context = useWatch({ control: form.control, name: "additional_context" }) ?? "";

  async function onSubmit(values: IdeaForm) {
    try {
      await create.mutateAsync(values);
      toast.success("Draft saved", { description: "Drafts are free and never use credits." });
      router.push("/projects");
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        for (const [field, msgs] of Object.entries(err.details)) {
          const message = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
          if (field in values) form.setError(field as keyof IdeaForm, { message });
        }
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't save your draft. Please try again.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-5">
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
        hint={<span className="tabular-nums">{description.length} / 2,000</span>}
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
        {errors.objectives && <p id="objectives-error" className="text-sm text-destructive">{errors.objectives.message}</p>}
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
        hint={<span className="tabular-nums">{context.length} / 1,000</span>}
      >
        <Textarea
          rows={3}
          maxLength={1000}
          {...fieldA11y("additional_context", errors.additional_context?.message, true)}
          {...form.register("additional_context")}
        />
      </FormField>

      <div className="sticky bottom-20 flex justify-end border-t border-border bg-card pt-4 md:static">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Save draft
        </Button>
      </div>
    </form>
  );
}
