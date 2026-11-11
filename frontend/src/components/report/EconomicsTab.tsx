"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UnitEconomicsSimulator } from "@/components/tools/UnitEconomicsSimulator";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { DEFAULT_INPUTS, parsePrice } from "@/lib/unitEconomics";
import { api, ApiError } from "@/services/api";

/** Unit economics on the founder's own numbers, saved to the project as "your inputs" (never evidence). */
export function EconomicsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["unit-economics", projectId], queryFn: () => api.getUnitEconomics(projectId) });
  const project = useProject(projectId);
  const save = useMutation({
    mutationFn: (inputs: Parameters<typeof api.saveUnitEconomics>[1]) => api.saveUnitEconomics(projectId, inputs),
    onSuccess: (data) => qc.setQueryData(["unit-economics", projectId], data),
  });

  if (saved.isPending || project.isPending)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading your numbers</span>
        <Skeleton className="h-96" />
      </div>
    );
  if (saved.isError) return <ErrorState title="Couldn't load your numbers" onRetry={() => saved.refetch()} />;
  const hypothesis = parsePrice(project.data?.price_hypothesis);
  const initial = saved.data.inputs ?? { ...DEFAULT_INPUTS, price: hypothesis ?? DEFAULT_INPUTS.price };

  return (
    <div className="flex flex-col gap-3">
      {!saved.data.inputs && hypothesis !== null && (
        <p className="text-sm text-muted-foreground">Price prefilled from your price hypothesis ({project.data?.price_hypothesis}).</p>
      )}
      <UnitEconomicsSimulator
        key={saved.data.updated_at ?? "new"}
        initial={initial}
        example={!saved.data.inputs}
        onSave={(inputs) => save.mutate(inputs)}
        saving={save.isPending}
        savedAt={saved.data.updated_at}
      />
      {save.isError && (
        <p role="alert" className="text-sm text-destructive-text">
          {save.error instanceof ApiError ? save.error.message : "Couldn't save. Check the numbers and try again."}
        </p>
      )}
    </div>
  );
}
