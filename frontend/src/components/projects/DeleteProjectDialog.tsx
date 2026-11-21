"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDeleteProject } from "@/hooks/useProjects";
import { ApiError } from "@/services/api";

/**
 * Confirmation before deleting a project. Says what goes with it and that it can't be undone; the server refuses
 * while research is running and its message is shown here. Controlled (`open`/`onOpenChange`) so it can be opened
 * from a menu item or a button.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  redirectTo,
}: {
  project: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to go after deleting, when the current page belonged to the project. */
  redirectTo?: string;
}) {
  const del = useDeleteProject();
  const router = useRouter();
  const error = del.error instanceof ApiError ? del.error.message : del.error ? "Couldn't delete the project. Please try again." : null;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) del.reset();
        onOpenChange(o);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_-20px_rgba(23,45,77,0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <AlertDialog.Title className="text-lg font-semibold leading-snug">Delete “{project.name}”?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This permanently deletes the project with its reports, evidence, watched competitor pages, Validation Lab
                pages and survey answers. Credits already spent aren&apos;t refunded. This can&apos;t be undone.
              </AlertDialog.Description>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-control border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive-text">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="min-h-11">
                Keep project
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(project.id, {
                  onSuccess: () => {
                    onOpenChange(false);
                    toast.success(`Deleted “${project.name}”.`);
                    if (redirectTo) router.push(redirectTo);
                  },
                })
              }
            >
              {del.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {del.isPending ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
