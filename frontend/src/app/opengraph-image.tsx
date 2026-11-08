import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME} — Stop building on assumptions. Start building on evidence.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview image (Open Graph + X). Brand colours only; no product claims. */
export default function OpengraphImage() {
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
          background: "#172D4D",
          backgroundImage:
            "radial-gradient(circle at 80% 0%, rgba(127,166,230,0.35), transparent 55%), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 60px 60px, 60px 60px",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#ffffff" />
            <path d="M9 16.5l4.2 4.2L23 11" fill="none" stroke="#172D4D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="23" cy="11" r="2.2" fill="#315EAA" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 600 }}>{BRAND_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Stop building on assumptions.</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#9DBBEB" }}>
            Start building on evidence.
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: "rgba(255,255,255,0.7)" }}>
            AI-powered market intelligence for founders
          </div>
        </div>
      </div>
    ),
    size,
  );
}
