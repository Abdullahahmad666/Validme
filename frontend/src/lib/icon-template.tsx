import { ImageResponse } from "next/og";

/** Brand mark as PNG at any size. `maskable` adds the safe-zone padding Android expects. */
export function renderBrandIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const mark = maskable ? Math.round(size * 0.62) : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#172D4D" : "transparent",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 32 32">
          <rect width="32" height="32" rx={maskable ? 0 : 8} fill="#172D4D" />
          <path d="M9 16.5l4.2 4.2L23 11" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="11" r="2.2" fill="#7FA6E6" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
