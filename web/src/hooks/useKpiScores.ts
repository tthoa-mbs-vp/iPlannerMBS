import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useToastStore } from "../stores/toastStore";
import type { KpiScore } from "@shared/types";

export function useKpiScores() {
  return useQuery({
    queryKey: ["kpi_scores"],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const result = await pb.collection("kpi_scores").getFullList<KpiScore>({
        fields: "id,task_id,base_score,difficulty_coeff,max_converted_score,progress_score,result_rating,final_score,created",
        expand: "task_id",
        requestKey: "kpi_scores-full",
      });
      return result;
    },
    staleTime: 60_000,
    retry: false,
  });
}

// C5: KPI records are computed server-side (hooks + recalc endpoint).
// This mutation calls the can_manage-gated endpoint instead of creating records client-side.
export function useBatchCalculateKpi() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await pb.send<{ success: boolean; created: number; failed: number }>("/api/custom/recalc-kpi", {
        method: "POST",
      });
      return { created: res?.created ?? 0, failed: res?.failed ?? 0, failedTasks: [] as string[] };
    },
    onSuccess: async ({ created }) => {
      if (created > 0) addToast("success", `Đã tính KPI cho ${created} nhiệm vụ`);
      await qc.invalidateQueries({ queryKey: ["kpi_scores"] });
    },
    onError: (error: Error) => {
      addToast("error", error instanceof Error ? error.message : "Có lỗi khi tính KPI");
    },
  });
}
