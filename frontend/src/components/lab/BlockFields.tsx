"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BLOCK_LABELS, hasLink, moveItem } from "@/lib/lab";
import type { Block } from "@/types/lab";

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const linky = hasLink(value);
  const Comp = multiline ? Textarea : Input;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? "" : " (optional)"}
      </Label>
      <Comp
        id={id}
        value={value}
        maxLength={max}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value)}
        aria-invalid={linky || (required && !value.trim()) || undefined}
        aria-describedby={`${id}-hint`}
        className={multiline ? "min-h-20" : undefined}
      />
      <p id={`${id}-hint`} className={linky ? "text-xs text-destructive-text" : "text-xs text-muted-foreground"}>
        {linky ? "Links and web or email addresses aren't allowed on pages." : `${value.length}/${max}`}
      </p>
    </div>
  );
}

function ListControls({ onUp, onDown, onRemove, label }: { onUp: () => void; onDown: () => void; onRemove: () => void; label: string }) {
  return (
    <span className="flex gap-1">
      <Button type="button" size="icon" variant="ghost" className="size-9" onClick={onUp} aria-label={`Move ${label} up`}>
        <ArrowUp aria-hidden />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="size-9" onClick={onDown} aria-label={`Move ${label} down`}>
        <ArrowDown aria-hidden />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="size-9" onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 aria-hidden />
      </Button>
    </span>
  );
}

/** Edit one block's plain-text fields. Lengths match the server's limits (backend/lab/blocks.py). */
export function BlockFields({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="grid gap-3">
          <Field label="Headline" value={block.headline} max={90} required onChange={(v) => onChange({ ...block, headline: v })} />
          <Field label="Subheadline" value={block.subheadline ?? ""} max={240} multiline onChange={(v) => onChange({ ...block, subheadline: v })} />
          <Field label="Button text" value={block.cta_label ?? ""} max={30} onChange={(v) => onChange({ ...block, cta_label: v })} />
        </div>
      );
    case "problem":
      return (
        <div className="grid gap-3">
          <Field label="Heading" value={block.heading ?? ""} max={80} onChange={(v) => onChange({ ...block, heading: v })} />
          <Field label="Text" value={block.body} max={800} multiline required onChange={(v) => onChange({ ...block, body: v })} />
        </div>
      );
    case "waitlist":
      return (
        <div className="grid gap-3">
          <Field label="Heading" value={block.heading ?? ""} max={80} onChange={(v) => onChange({ ...block, heading: v })} />
          <Field label="Text above the form" value={block.body ?? ""} max={240} onChange={(v) => onChange({ ...block, body: v })} />
          <Field label="Button text" value={block.button ?? ""} max={30} onChange={(v) => onChange({ ...block, button: v })} />
          <p className="text-xs text-muted-foreground">
            The consent text, the email field and the privacy links are added for you and can&apos;t be changed.
          </p>
        </div>
      );
    case "benefits":
      return (
        <div className="grid gap-3">
          <Field label="Heading" value={block.heading ?? ""} max={80} onChange={(v) => onChange({ ...block, heading: v })} />
          {block.items.map((it, i) => (
            <fieldset key={i} className="grid gap-2 rounded-control border border-border p-3">
              <legend className="flex w-full items-center justify-between px-1 text-xs font-medium">
                Benefit {i + 1}
                <ListControls
                  label={`benefit ${i + 1}`}
                  onUp={() => onChange({ ...block, items: moveItem(block.items, i, i - 1) })}
                  onDown={() => onChange({ ...block, items: moveItem(block.items, i, i + 1) })}
                  onRemove={() => block.items.length > 1 && onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                />
              </legend>
              <Field label="Title" value={it.title} max={60} required onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, title: v } : x)) })} />
              <Field label="Text" value={it.body ?? ""} max={240} onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, body: v } : x)) })} />
            </fieldset>
          ))}
          {block.items.length < 6 && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => onChange({ ...block, items: [...block.items, { title: "New benefit", body: "" }] })}>
              <Plus aria-hidden /> Add a benefit
            </Button>
          )}
        </div>
      );
    case "pricing":
      return (
        <div className="grid gap-3">
          <Field label="Heading" value={block.heading ?? ""} max={80} onChange={(v) => onChange({ ...block, heading: v })} />
          <p className="text-xs text-muted-foreground">
            The page always adds: &ldquo;Not available yet: these are prices being tested, and nothing is charged.&rdquo;
          </p>
          {block.items.map((it, i) => (
            <fieldset key={i} className="grid gap-2 rounded-control border border-border p-3">
              <legend className="flex w-full items-center justify-between px-1 text-xs font-medium">
                Price point {i + 1}
                <ListControls
                  label={`price point ${i + 1}`}
                  onUp={() => onChange({ ...block, items: moveItem(block.items, i, i - 1) })}
                  onDown={() => onChange({ ...block, items: moveItem(block.items, i, i + 1) })}
                  onRemove={() => block.items.length > 1 && onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                />
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Name" value={it.name} max={40} required onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
                <Field label="Price" value={it.price} max={20} required onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, price: v } : x)) })} />
                <Field label="Period" value={it.period ?? ""} max={20} onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, period: v } : x)) })} />
              </div>
              <Field
                label="Features, one per line"
                value={(it.features ?? []).join("\n")}
                max={6 * 81}
                multiline
                onChange={(v) =>
                  onChange({
                    ...block,
                    items: block.items.map((x, j) => (j === i ? { ...x, features: v.split("\n").map((f) => f.slice(0, 80)).filter((f, k, a) => f.trim() || k === a.length - 1).slice(0, 6) } : x)),
                  })
                }
              />
            </fieldset>
          ))}
          {block.items.length < 3 && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => onChange({ ...block, items: [...block.items, { name: "Option", price: "$0", period: "/month", features: [] }] })}>
              <Plus aria-hidden /> Add a price point
            </Button>
          )}
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-3">
          <Field label="Heading" value={block.heading ?? ""} max={80} onChange={(v) => onChange({ ...block, heading: v })} />
          {block.items.map((it, i) => (
            <fieldset key={i} className="grid gap-2 rounded-control border border-border p-3">
              <legend className="flex w-full items-center justify-between px-1 text-xs font-medium">
                Question {i + 1}
                <ListControls
                  label={`question ${i + 1}`}
                  onUp={() => onChange({ ...block, items: moveItem(block.items, i, i - 1) })}
                  onDown={() => onChange({ ...block, items: moveItem(block.items, i, i + 1) })}
                  onRemove={() => block.items.length > 1 && onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                />
              </legend>
              <Field label="Question" value={it.q} max={120} required onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, q: v } : x)) })} />
              <Field label="Answer" value={it.a} max={500} multiline required onChange={(v) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, a: v } : x)) })} />
            </fieldset>
          ))}
          {block.items.length < 8 && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => onChange({ ...block, items: [...block.items, { q: "New question", a: "Answer" }] })}>
              <Plus aria-hidden /> Add a question
            </Button>
          )}
        </div>
      );
  }
}

export function blockTitle(b: Block): string {
  return BLOCK_LABELS[b.type];
}
