import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

// Image rendering can't read CSS variables; these mirror the tokens in globals.css.
const NAVY = "#172D4D";
const ACCENT = "#9DBBEB";
const ACCENT_SOFT = "#7FA6E6";

// Inter (same as the site), bundled via @fontsource/inter so builds never need the network.
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
let fonts: { name: string; data: Buffer; weight: 500 | 600 | 700; style: "normal" }[] | null = null;
function interFonts() {
  fonts ??= ([500, 600, 700] as const).map((weight) => ({
    name: "Inter",
    data: readFileSync(path.join(FONT_DIR, `inter-latin-${weight}-normal.woff`)),
    weight,
    style: "normal" as const,
  }));
  return fonts;
}

/** Brand social card used for every page (Open Graph, X, and the root fallback). */
export function renderSocialImage({
  eyebrow,
  headline,
  subline,
  width,
  height,
}: {
  eyebrow: string;
  headline: string;
  subline?: string;
  width: number;
  height: number;
}) {
  const long = headline.length > 48;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: NAVY,
          backgroundImage:
            "radial-gradient(circle at 85% 0%, rgba(127,166,230,0.38), transparent 55%), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 60px 60px, 60px 60px",
          color: "white",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="56" height="56" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="8" fill="#ffffff" />
              <path d="M9 16.5l4.2 4.2L23 11" fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="23" cy="11" r="2.2" fill="#315EAA" />
            </svg>
            <div style={{ fontSize: 34, fontWeight: 600 }}>{BRAND_NAME}</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: ACCENT,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            {eyebrow}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: long ? 60 : 72,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            {headline}
          </div>
          {subline && (
            <div style={{ display: "flex", marginTop: 26, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,0.72)", maxWidth: 980 }}>
              {subline}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 34, height: 6, width: 120, borderRadius: 3, background: ACCENT_SOFT }} />
        </div>
      </div>
    ),
    { width, height, fonts: interFonts() },
  );
}
