import { renderBrandIcon } from "@/lib/icon-template";

// PNG brand icons for the web manifest, structured-data logo and platforms that ignore SVG.
const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const icon = ICONS[file];
  if (!icon) return new Response("Not found", { status: 404 });
  return renderBrandIcon(icon.size, { maskable: icon.maskable });
}
