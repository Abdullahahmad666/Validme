"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SITE_URL } from "@/lib/brand";
import { api, ApiError } from "@/services/api";

function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-control border border-border bg-muted/60 p-3 pr-12 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1"
        aria-label={copied ? "Copied" : `Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </div>
  );
}

export function ApiKeys() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: api.listApiKeys });
  const [name, setName] = useState("Claude");
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.createApiKey(name.trim() || "Claude"),
    onSuccess: (k) => {
      setCreated(k.key);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
  const active = keys.data?.results.filter((k) => !k.revoked) ?? [];
  const apiUrl = `${SITE_URL}/api`;
  const keyText = created ?? "<your API key>";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-border bg-card p-5" aria-labelledby="keys-h">
        <h2 id="keys-h" className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4 text-primary" aria-hidden /> API keys
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keys let the MCP server read your projects and start research from Claude. Research started this way spends your
          credits. A key can&apos;t change your account or create other keys.
        </p>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="key-name">Key name</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11" />
          </div>
          <Button type="submit" disabled={create.isPending} className="h-11">
            {create.isPending ? "Creating…" : "Create key"}
          </Button>
        </form>
        {create.isError && (
          <p role="alert" className="mt-2 text-sm text-destructive-text">
            {create.error instanceof ApiError && create.error.status === 409
              ? "You've reached the key limit. Revoke one first."
              : "Couldn't create the key. Please try again."}
          </p>
        )}
        {created && (
          <div className="mt-4 rounded-control border border-success/40 bg-success/5 p-3" role="status">
            <p className="text-sm font-medium">Copy this key now. It won&apos;t be shown again.</p>
            <div className="mt-2">
              <CopyBlock text={created} label="API key" />
            </div>
          </div>
        )}

        <div className="mt-5">
          {keys.isPending ? (
            <Skeleton className="h-16" />
          ) : keys.isError ? (
            <ErrorState title="Couldn't load your keys" onRetry={() => keys.refetch()} />
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active keys.</p>
          ) : (
            <ul className="divide-y divide-border rounded-control border border-border">
              {active.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{k.prefix}…</code> · created {fmtDate(k.created_at)} · {k.last_used_at ? `last used ${fmtDate(k.last_used_at)}` : "never used"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (window.confirm(`Revoke “${k.name}”? Anything using it stops working immediately.`)) revoke.mutate(k.id);
                    }}
                  >
                    <Trash2 aria-hidden /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-5" aria-labelledby="mcp-h">
        <h2 id="mcp-h" className="font-semibold">
          Use ValidMe from Claude
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The MCP server lets Claude Code or Claude Desktop validate ideas, read reports and suggest channels. It needs Python
          3.11+ and the <code>mcp-server</code> folder of the ValidMe repository.
        </p>
        <ol className="mt-4 flex flex-col gap-4 text-sm">
          <li>
            <p className="font-medium">1. Install the server</p>
            <div className="mt-2">
              <CopyBlock label="install command" text={`cd mcp-server\npip install -e .`} />
            </div>
          </li>
          <li>
            <p className="font-medium">2. Add it to Claude Code</p>
            <div className="mt-2">
              <CopyBlock
                label="Claude Code command"
                text={`claude mcp add validme --scope user -e VALIDME_API_URL=${apiUrl} -e VALIDME_API_KEY=${keyText} -- validme-mcp`}
              />
            </div>
          </li>
          <li>
            <p className="font-medium">3. Or add it to Claude Desktop</p>
            <p className="mt-1 text-muted-foreground">In Settings → Developer → Edit config, add:</p>
            <div className="mt-2">
              <CopyBlock
                label="Claude Desktop config"
                text={JSON.stringify(
                  { mcpServers: { validme: { command: "validme-mcp", env: { VALIDME_API_URL: apiUrl, VALIDME_API_KEY: keyText } } } },
                  null,
                  2,
                )}
              />
            </div>
          </li>
          <li>
            <p className="font-medium">4. Ask Claude</p>
            <p className="mt-1 text-muted-foreground">
              “Validate my idea: … for … in the UK.” Claude starts the research, waits for it, then reads the report. Tools:
              validate_idea, get_research_status, get_report, list_reports, search_evidence, list_competitors, suggest_channels.
            </p>
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Keep keys out of shared files and repositories. Revoke a key here if it leaks.
        </p>
      </section>
    </div>
  );
}
