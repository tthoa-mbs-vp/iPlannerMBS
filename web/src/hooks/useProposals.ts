import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type { Proposal } from "@shared/types";


export function useProposalsByTask(taskId: string) {
  return useQuery({
    queryKey: ["proposals", "task", taskId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const records = await pb.collection("proposals").getFullList<Proposal>({
        filter: `task_id="${taskId}"`,
        sort: "-created",
        expand: "task_id,requester_id,approver_id",
      });
      return records;
    },
    enabled: !!taskId,
    staleTime: 10_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateProposal() {
  return useMutationWithToast(
    (data: Partial<Proposal>) => pb.collection("proposals").create(data),
    {
      successMessage: "Gửi đề xuất thành công",
      invalidateKeys: [["proposals"]],
    }
  );
}

export function useUpdateProposal() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<Proposal> }) =>
      pb.collection("proposals").update(id, data),
    {
      invalidateKeys: [["proposals"]],
    }
  );
}

export function useWithdrawProposal() {
  return useMutationWithToast(
    (id: string) =>
      pb.collection("proposals").update(id, { status: "withdrawn" }),
    {
      successMessage: "Đã rút lại đề xuất",
      invalidateKeys: [["proposals"]],
    }
  );
}
