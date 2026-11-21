import { OptionalTag, RequiredMark } from "@/components/shared/FieldTag";
import { Label } from "@/components/ui/label";

/** Label + control + hint/error, with ids wired for screen readers. */
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  /** Shows a red asterisk (read as "required"). */
  required?: boolean;
  /** Shows a muted "Optional" tag. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
        {optional && <OptionalTag />}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

export function fieldA11y(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}
