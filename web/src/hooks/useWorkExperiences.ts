import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { WorkExperience } from "@shared/types";

const COLLECTION = "work_experiences";

export function useWorkExperiences(userId: string | undefined) {
  return useQuery({
    queryKey: ["work_experiences", userId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection(COLLECTION).getFullList<WorkExperience>({
        sort: "-start_date",
        filter: userId ? `user_id="${userId}"` : "",
      });
    },
    enabled: !!userId,
    staleTime: Infinity,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateWorkExperience() {
  return useMutationWithToast(
    (data: Partial<WorkExperience>) =>
      pb.collection(COLLECTION).create(data),
    {
      successMessage: "Đã thêm quá trình công tác",
      invalidateKeys: [["work_experiences"]],
    }
  );
}

export function useUpdateWorkExperience() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<WorkExperience> }) =>
      pb.collection(COLLECTION).update(id, data),
    {
      successMessage: "Đã cập nhật quá trình công tác",
      invalidateKeys: [["work_experiences"]],
    }
  );
}

export function useDeleteWorkExperience() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).delete(id),
    {
      successMessage: "Đã xóa quá trình công tác",
      invalidateKeys: [["work_experiences"]],
    }
  );
}
