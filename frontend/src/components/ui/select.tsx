"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "cn";

/**
 * The app's single-choice picker. A native <select> opens the operating system's own list, which can't match the
 * glass UI, so this uses Radix Select: a styled listbox with the same keyboard behaviour (arrows, Home/End,
 * type-ahead, Esc), screen-reader roles and focus handling, and a trigger that works with <label htmlFor>.
 *
 * Values are strings (as with <select>). An option with value "" ("All sources", "None") is supported even though
 * Radix reserves "" for "nothing chosen": it is mapped to a private sentinel and back.
 */
export type SelectOption = {
  value: string;
  label: React.ReactNode;
  /** Plain text for type-ahead when `label` isn't a string. */
  textValue?: string;
  disabled?: boolean;
};

const EMPTY = "__validme_empty__";

export type SelectProps = {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "default" | "sm";
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  onBlur?: () => void;
};

export function toInternal(value: SelectProps["value"], options: readonly SelectOption[]): string {
  const v = value == null ? "" : String(value);
  if (v !== "") return v;
  return options.some((o) => o.value === "") ? EMPTY : "";
}

export function fromInternal(value: string): string {
  return value === EMPTY ? "" : value;
}

export function Select({
  value,
  onValueChange,
  options,
  id,
  name,
  placeholder,
  disabled,
  required,
  size = "default",
  className,
  contentClassName,
  onBlur,
  ...aria
}: SelectProps) {
  const internal = toInternal(value, options);
  // Render the chosen label ourselves so the server HTML (and the first paint) already shows it; Radix alone
  // fills it in only after hydration.
  const chosen = internal === "" ? undefined : options.find((o) => (o.value === "" ? EMPTY : o.value) === internal);
  return (
    <SelectPrimitive.Root
      value={internal}
      onValueChange={(v) => onValueChange(fromInternal(v))}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        onBlur={onBlur}
        {...aria}
        className={cn(
          "group/select inline-flex w-fit min-w-36 max-w-full items-center justify-between gap-2 rounded-control border border-input bg-card/85 px-3 text-left text-sm shadow-[0_1px_2px_rgba(23,45,77,0.06)] backdrop-blur-sm transition-[color,box-shadow,border-color] outline-none",
          "hover:border-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/25",
          "data-placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          size === "sm" ? "h-10" : "h-11",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder}>{chosen?.label}</SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]/select:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) max-w-[min(32rem,calc(100vw-1.5rem))] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-xl border border-border bg-popover/95 text-popover-foreground shadow-[0_18px_40px_-16px_rgba(23,45,77,0.35)] backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 motion-reduce:animate-none",
            contentClassName,
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-muted-foreground">
            <ChevronUpIcon aria-hidden className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value === "" ? EMPTY : o.value}
                value={o.value === "" ? EMPTY : o.value}
                disabled={o.disabled}
                textValue={o.textValue ?? (typeof o.label === "string" ? o.label : undefined)}
                data-slot="select-item"
                className="relative flex min-h-10 w-full cursor-default items-center rounded-lg py-2 pr-9 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[state=checked]:font-medium data-[state=checked]:text-primary data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <span className="absolute right-3 flex size-4 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon aria-hidden className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-muted-foreground">
            <ChevronDownIcon aria-hidden className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
