import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import { addSoftDeleteFilter } from "../utils/filters";
import type { Plan } from "@shared/types";

const COLLECTION = "plans";

export function usePlans(filter?: string) {
  return useQuery({
    queryKey: ["plans", filter],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const records = await pb.collection(COLLECTION).getFullList<Plan>(500, {
        sort: "-created",
        filter: addSoftDeleteFilter(filter),
        expand: "leader_id,host_dept_id,partner_dept_ids,group_id",
      });
      return records;
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const record = await pb.collection(COLLECTION).getOne<Plan>(id, {
        expand: "leader_id,host_dept_id,partner_dept_ids,group_id",
      });
      return record;
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useTrashedPlans() {
  return useQuery({
    queryKey: ["plans", "trashed"],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection(COLLECTION).getFullList<Plan>({
        sort: "-updated",
        filter: "is_deleted=true",
        expand: "leader_id,host_dept_id,group_id",
      });
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreatePlan() {
  return useMutationWithToast(
    (data: Partial<Plan>) => pb.collection(COLLECTION).create(data),
    {
      successMessage: "Tạo kế hoạch thành công",
      invalidateKeys: [["plans"]],
    }
  );
}

export function useUpdatePlan() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<Plan> }) =>
      pb.collection(COLLECTION).update(id, data),
    {
      successMessage: "Cập nhật kế hoạch thành công",
      invalidateKeys: [["plans"]],
    }
  );
}

export function useBulkSoftDeletePlans() {
  return useMutationWithToast(
    async (ids: string[]) => {
      for (const id of ids) {
        await pb.collection(COLLECTION).update(id, { is_deleted: true });
      }
    },
    {
      successMessage: "Đã xóa các kế hoạch đã chọn",
      invalidateKeys: [["plans"]],
    }
  );
}

export function useSoftDeletePlan() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).update(id, { is_deleted: true }),
    {
      successMessage: "Đã xóa kế hoạch",
      invalidateKeys: [["plans"]],
    }
  );
}

export function useRestorePlan() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).update(id, { is_deleted: false }),
    {
      successMessage: "Khôi phục kế hoạch thành công",
      invalidateKeys: [["plans"]],
    }
  );
}

export function usePermanentDeletePlan() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).delete(id),
    {
      successMessage: "Xóa vĩnh viễn kế hoạch",
      invalidateKeys: [["plans"]],
    }
  );
}

export function useBulkPermanentDeletePlans() {
  return useMutationWithToast(
    async (ids: string[]) => {
      for (const id of ids) {
        await pb.collection(COLLECTION).delete(id);
      }
    },
    {
      successMessage: "Đã xóa vĩnh viễn các kế hoạch đã chọn",
      invalidateKeys: [["plans"]],
    }
  );
}
