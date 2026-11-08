import { buildLlmsTxt } from "@/lib/llms";

// Prerendered at build time (no request data).
export function GET() {
  return new Response(buildLlmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
