/** Shared bits for horizontal bar charts: left-aligned category labels and a label column sized to fit them. */

type TickProps = { y?: number | string; payload?: { value: string } };

const CHAR_PX = 6.6; // ~12px Inter

/** Label column width from the longest label, clamped so bars always keep most of the row. */
export function labelColumn(labels: string[], max = 220, min = 64): number {
  const longest = labels.reduce((n, l) => Math.max(n, l.length), 0);
  return Math.round(Math.min(max, Math.max(min, longest * CHAR_PX + 12)));
}

/** A Recharts y-axis tick drawn from the chart's left edge, truncated to the column. */
export function leftTick(width: number) {
  const maxChars = Math.max(6, Math.floor((width - 12) / CHAR_PX));
  function LeftTick({ y, payload }: TickProps) {
    const text = String(payload?.value ?? "");
    return (
      <text x={0} y={Number(y)} dy={4} textAnchor="start" fill="var(--foreground)" fontSize={12}>
        {text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text}
        {text.length > maxChars && <title>{text}</title>}
      </text>
    );
  }
  return LeftTick;
}

/** Below this card width, horizontal bar charts put each label above its bar instead of in a column. */
export const STACK_BELOW = 480;

// Recharts passes more (and looser) props; only these are read.
type LabelProps = { y?: unknown; value?: unknown };

/** LabelList content for stacked layout: the category name just above the bar, from the left edge. */
export function aboveLabel(maxChars = 48) {
  function AboveLabel(props: LabelProps) {
    const { y, value } = props;
    const text = String(value ?? "");
    return (
      <text x={0} y={Number(y) - 5} textAnchor="start" fill="var(--foreground)" fontSize={12}>
        {text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text}
      </text>
    );
  }
  return AboveLabel;
}
