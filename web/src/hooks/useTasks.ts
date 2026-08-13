import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import { addSoftDeleteFilter } from "../utils/filters";
import type { Task } from "@shared/types";

const COLLECTION = "tasks";

export function useTasks(filter?: string) {
  return useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const records = await pb.collection(COLLECTION).getFullList<Task>(500, {
        sort: "-created",
        filter: addSoftDeleteFilter(filter),
        expand: "plan_id,host_dept_id,executor_id,supervisor_id,collaborator_ids",
      });
      return records;
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const record = await pb.collection(COLLECTION).getOne<Task>(id, {
        expand: "plan_id,host_dept_id,executor_id,supervisor_id,collaborator_ids",
      });
      return record;
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useTrashedTasks() {
  return useQuery({
    queryKey: ["tasks", "trashed"],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection(COLLECTION).getFullList<Task>({
        sort: "-updated",
        filter: "is_deleted=true",
        expand: "plan_id,executor_id,supervisor_id",
      });
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateTask() {
  return useMutationWithToast(
    (data: Partial<Task>) => pb.collection(COLLECTION).create(data),
    {
      successMessage: "Tạo nhiệm vụ thành công",
      invalidateKeys: [["tasks"]],
    }
  );
}

export function useUpdateTask() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<Task> }) =>
      pb.collection(COLLECTION).update(id, data),
    {
      successMessage: "Cập nhật nhiệm vụ thành công",
      invalidateKeys: [["tasks"], ["task"]],
    }
  );
}

export function useBulkSoftDeleteTasks() {
  return useMutationWithToast(
    async (ids: string[]) => {
      for (const id of ids) {
        await pb.collection(COLLECTION).update(id, { is_deleted: true });
      }
    },
    {
      successMessage: "Đã xóa các nhiệm vụ đã chọn",
      invalidateKeys: [["tasks"]],
    }
  );
}

export function useSoftDeleteTask() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).update(id, { is_deleted: true }),
    {
      successMessage: "Đã xóa nhiệm vụ",
      invalidateKeys: [["tasks"], ["task"]],
    }
  );
}

export function useRestoreTask() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).update(id, { is_deleted: false }),
    {
      successMessage: "Khôi phục nhiệm vụ thành công",
      invalidateKeys: [["tasks"], ["task"]],
    }
  );
}

export function usePermanentDeleteTask() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).delete(id),
    {
      successMessage: "Xóa vĩnh viễn nhiệm vụ",
      invalidateKeys: [["tasks"], ["task"]],
    }
  );
}

export function useBulkPermanentDeleteTasks() {
  return useMutationWithToast(
    async (ids: string[]) => {
      for (const id of ids) {
        await pb.collection(COLLECTION).delete(id);
      }
    },
    {
      successMessage: "Đã xóa vĩnh viễn các nhiệm vụ đã chọn",
      invalidateKeys: [["tasks"]],
    }
  );
}
