import type { MetadataRoute } from "next";
import { PAGES } from "@/content/seo";
import { BRAND_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} — startup idea validation`,
    short_name: BRAND_NAME,
    description: PAGES.home.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#172D4D",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/icons/maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
