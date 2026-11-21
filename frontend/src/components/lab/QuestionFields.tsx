"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { VERDICT_MAJORITY_PCT, VERDICT_MIN_ANSWERS } from "@/lib/apiScopes";
import { changeType, hasLink, QUESTION_LABELS, removeOption } from "@/lib/lab";
import { cn } from "@/lib/utils";
import type { Question, QuestionType } from "@/types/lab";
import type { Assumption } from "@/types/report";


function Text({
  label,
  value,
  max,
  onChange,
  required,
  disabled,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const linky = hasLink(value);
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? "" : " (optional)"}
      </Label>
      <Input
        id={id}
        className="h-11"
        value={value}
        maxLength={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={linky || undefined}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={cn("text-xs", linky ? "text-destructive-text" : "text-muted-foreground")}>
        {linky ? "Links and web or email addresses aren't allowed." : `${value.length}/${max}`}
      </p>
    </div>
  );
}

/**
 * Which answers support the linked assumption: the founder's rule, set before reading results. With it, the assumption
 * is marked from the answers (backend lab.verdicts). Allowed after answers too, but then flagged as chosen late.
 */
function SupportRule({ q, onChange, locked }: { q: Question; onChange: (q: Question) => void; locked: boolean }) {
  const id = useId();
  const late = locked ? " People have already answered, so a rule set now is marked as chosen after seeing results." : "";
  if (q.type === "text") {
    return <p className="text-xs text-muted-foreground">Typed answers aren&apos;t judged automatically: read them and set the assumption&apos;s status yourself.</p>;
  }
  if (q.type === "scale") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-xs">
          Supports the assumption at
        </Label>
        <Select
          id={id}
          value={q.support_min ?? ""}
          onValueChange={(v) => onChange({ ...q, support_min: v ? Number(v) : null })}
          aria-describedby={`${id}-hint`}
          options={[
            { value: "", label: "No rule (don’t judge automatically)" },
            ...[2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} or higher` })),
          ]}
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Decide this before you read the results.{late}
        </p>
      </div>
    );
  }
  const chosen = new Set(q.support_options ?? []);
  const options = q.options ?? [];
  return (
    <fieldset className="grid gap-1 rounded-control border border-dashed border-border p-3" aria-describedby={`${id}-hint`}>
      <legend className="px-1 text-xs font-medium">Which answers support the assumption?</legend>
      {options.map((o, i) => (
        <label key={i} className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={chosen.has(i)}
            onChange={(e) => {
              const next = new Set(chosen);
              if (e.target.checked) next.add(i);
              else next.delete(i);
              onChange({ ...q, support_options: [...next].sort((a, b) => a - b) });
            }}
          />
          {o || `Option ${i + 1}`}
        </label>
      ))}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        The assumption is marked supported when most people who answered (the whole 95% range above {VERDICT_MAJORITY_PCT}%,
        with at least {VERDICT_MIN_ANSWERS} answers) picked one of these, and contradicted when the whole range is below it. Leave all unticked to judge it
        yourself. Decide this before you read the results.{late}
      </p>
    </fieldset>
  );
}

/**
 * One survey question. `locked` (the survey has answers) keeps the type, options and their order fixed, because stored
 * answers point at them; wording, help text and scale labels can still be fixed.
 */
export function QuestionFields({
  question: q,
  onChange,
  assumptions,
  locked,
}: {
  question: Question;
  onChange: (q: Question) => void;
  assumptions: Assumption[];
  locked: boolean;
}) {
  const ids = { type: useId(), assumption: useId(), required: useId() };
  const options = q.options ?? [];
  const setOption = (i: number, v: string) => onChange({ ...q, options: options.map((o, j) => (j === i ? v : o)) });
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={ids.type} className="text-xs">
            Answer type
          </Label>
          <Select
            id={ids.type}
            value={q.type}
            disabled={locked}
            onValueChange={(v) => onChange(changeType(q, v as QuestionType))}
            options={(Object.keys(QUESTION_LABELS) as QuestionType[]).map((t) => ({ value: t, label: QUESTION_LABELS[t] }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={ids.assumption} className="text-xs">
            Tests assumption (optional)
          </Label>
          <Select
            id={ids.assumption}
            value={q.assumption_id ?? ""}
            onValueChange={(v) => onChange({ ...q, assumption_id: v ? Number(v) : null })}
            options={[
              { value: "", label: "None" },
              ...assumptions.map((a) => {
                const text = a.text.length > 70 ? `${a.text.slice(0, 70)}…` : a.text;
                return { value: String(a.id), label: a.status === "contradicted" ? `${text} (contradicted)` : text };
              }),
              // A link to an assumption that no longer exists still shows as something, never a blank box.
              ...(q.assumption_id != null && !assumptions.some((a) => a.id === q.assumption_id)
                ? [{ value: String(q.assumption_id), label: "An assumption that was deleted" }]
                : []),
            ]}
          />
        </div>
      </div>
      <Text label="Question" value={q.prompt} max={200} required onChange={(v) => onChange({ ...q, prompt: v })} />
      <Text label="Help text" value={q.help ?? ""} max={200} onChange={(v) => onChange({ ...q, help: v })} />
      {(q.type === "single" || q.type === "multi") && (
        <fieldset className="grid gap-2 rounded-control border border-border p-3">
          <legend className="px-1 text-xs font-medium">Options ({q.type === "single" ? "people pick one" : "people pick any"})</legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Text label={`Option ${i + 1}`} value={o} max={80} required disabled={locked} onChange={(v) => setOption(i, v)} />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="mb-5 size-11"
                disabled={locked || options.length <= 2}
                onClick={() => onChange(removeOption(q, i))}
                aria-label={`Remove option ${i + 1}`}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {options.length < 8 && !locked && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => onChange({ ...q, options: [...options, ""] })}>
              <Plus aria-hidden /> Add an option
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Cover every case, e.g. add &ldquo;None of these&rdquo; or &ldquo;Not sure&rdquo;.</p>
        </fieldset>
      )}
      {q.type === "scale" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Label for 1" value={q.low_label ?? ""} max={30} onChange={(v) => onChange({ ...q, low_label: v })} />
          <Text label="Label for 5" value={q.high_label ?? ""} max={30} onChange={(v) => onChange({ ...q, high_label: v })} />
        </div>
      )}
      {q.assumption_id != null && <SupportRule q={q} onChange={onChange} locked={locked} />}
      <label htmlFor={ids.required} className="flex min-h-11 items-center gap-2 text-sm">
        <input id={ids.required} type="checkbox" className="size-5 accent-primary" checked={!!q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} />
        Required
      </label>
    </div>
  );
}
