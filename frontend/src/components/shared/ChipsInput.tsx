"use client";

import { Check, Plus, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normaliseChip } from "@/lib/wizard";
import { cn } from "@/lib/utils";

const SHOWN = 8;

/** Suggestions for a draft: names starting with it, then names with a word starting with it, then any containing it. */
export function matchSuggestions(draft: string, all: readonly string[], taken: readonly string[], popular?: readonly string[]): string[] {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  const q = draft.trim().toLowerCase();
  if (!q) return (popular ?? all).filter((s) => !used.has(s.toLowerCase())).slice(0, SHOWN);
  const starts: string[] = [];
  const wordStarts: string[] = [];
  const contains: string[] = [];
  for (const s of all) {
    const l = s.toLowerCase();
    if (used.has(l)) continue;
    if (l.startsWith(q)) starts.push(s);
    else if (l.split(/[\s(,-]+/).some((w) => w.startsWith(q))) wordStarts.push(s);
    else if (l.includes(q)) contains.push(s);
  }
  return [...starts, ...wordStarts, ...contains].slice(0, SHOWN);
}

/**
 * Add/remove list of short values (audience segments, geographies, excluded terms, URLs).
 * Enter or comma adds; each chip has its own remove button (keyboard reachable). With `suggestions`, a styled
 * listbox (ARIA combobox pattern) offers matches as you type: arrows move, Enter picks, Esc closes. Free text is
 * still allowed.
 */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
  max,
  maxLength = 120,
  suggestions = [],
  popular,
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
  suggestions?: readonly string[];
  /** Shown when the field is empty (defaults to the first suggestions). */
  popular?: readonly string[];
  validate?: (v: string) => string | null;
  describedBy?: string;
  invalid?: boolean;
  inputMode?: "url" | "text";
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const full = value.length >= max;

  const matches = useMemo(
    () => (suggestions.length ? matchSuggestions(draft, suggestions, value, popular) : []),
    [draft, suggestions, value, popular],
  );
  const showList = open && !full && matches.length > 0;

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
    setActive(-1);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Added">
          {value.map((v) => (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] py-1 pl-3 pr-1 text-sm"
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
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            id={id}
            value={draft}
            disabled={full}
            maxLength={maxLength}
            inputMode={inputMode}
            autoComplete="off"
            placeholder={full ? `Maximum of ${max} reached` : placeholder}
            aria-invalid={invalid || !!error || undefined}
            aria-describedby={[describedBy, error ? `${id}-chip-error` : null].filter(Boolean).join(" ") || undefined}
            {...(suggestions.length
              ? {
                  role: "combobox",
                  "aria-expanded": showList,
                  "aria-controls": listId,
                  "aria-autocomplete": "list" as const,
                  "aria-activedescendant": showList && active >= 0 ? `${listId}-${active}` : undefined,
                }
              : {})}
            className="h-11"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              if (showList && e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % matches.length);
              } else if (showList && e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
              } else if (e.key === "Escape" && showList) {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "Enter" || (e.key === "," && inputMode !== "url")) {
                e.preventDefault();
                add(showList && active >= 0 ? matches[active] : draft);
              } else if (!open && e.key === "ArrowDown") {
                setOpen(true);
              }
            }}
          />
          {suggestions.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Suggestions"
              hidden={!showList}
              className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1 text-sm text-popover-foreground shadow-[0_18px_40px_-16px_rgba(23,45,77,0.35)] backdrop-blur-md"
            >
              {!draft.trim() && (
                <li role="presentation" className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
                  Popular
                </li>
              )}
              {matches.map((m, i) => (
                <li
                  key={m}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // Keep focus in the input; pick on click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    add(m);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-10 cursor-default items-center justify-between gap-2 rounded-lg px-3 py-2",
                    i === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <Highlight text={m} query={draft} />
                  {i === active && <Check className="size-4 text-primary" aria-hidden />}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="outline" className="h-11" disabled={full || !draft.trim()} onClick={() => add(draft)}>
          <Plus aria-hidden />
          Add
        </Button>
      </div>
      {error && (
        <p id={`${id}-chip-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The matched part of a suggestion in bold, so it's clear why it's listed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <span className="truncate">{text}</span>;
  return (
    <span className="truncate">
      {text.slice(0, at)}
      <strong className="font-semibold text-foreground">{text.slice(at, at + q.length)}</strong>
      {text.slice(at + q.length)}
    </span>
  );
}
