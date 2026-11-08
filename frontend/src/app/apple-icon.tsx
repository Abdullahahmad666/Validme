import { renderBrandIcon } from "@/lib/icon-template";

// iOS home screen + iMessage link previews. Full-bleed navy (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon(180, { maskable: true });
}
