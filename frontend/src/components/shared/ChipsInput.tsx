"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normaliseChip } from "@/lib/wizard";
import { cn } from "@/lib/utils";

/**
 * Add/remove list of short values (audience segments, geographies, excluded terms, URLs).
 * Enter or comma adds; each chip has its own remove button (keyboard reachable).
 */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
  max,
  maxLength = 120,
  suggestions = [],
  validate,
  describedBy,
  invalid,
  inputMode,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max: number;
  maxLength?: number;
  suggestions?: string[];
  validate?: (v: string) => string | null;
  describedBy?: string;
  invalid?: boolean;
  inputMode?: "url" | "text";
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const full = value.length >= max;

  function add(raw: string) {
    const v = normaliseChip(raw);
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setError("Already added.");
      return;
    }
    const problem = validate?.(v) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    onChange([...value, v]);
    setDraft("");
    setError(null);
  }

  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Added">
          {value.map((v) => (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 py-1 pl-3 pr-1 text-sm"
            >
              <span className="truncate">{v}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label={`Remove ${v}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={full}
          maxLength={maxLength}
          inputMode={inputMode}
          list={remaining.length ? listId : undefined}
          placeholder={full ? `Maximum of ${max} reached` : placeholder}
          aria-invalid={invalid || !!error || undefined}
          aria-describedby={[describedBy, error ? `${id}-chip-error` : null].filter(Boolean).join(" ") || undefined}
          className={cn("h-11")}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "," && inputMode !== "url")) {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <Button type="button" variant="outline" disabled={full || !draft.trim()} onClick={() => add(draft)}>
          <Plus aria-hidden />
          Add
        </Button>
      </div>
      {remaining.length > 0 && (
        <datalist id={listId}>
          {remaining.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {error && (
        <p id={`${id}-chip-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
