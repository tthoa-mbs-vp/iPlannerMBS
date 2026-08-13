import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { Qualification } from "@shared/types";

const COLLECTION = "qualifications";

export function useQualifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["qualifications", userId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection(COLLECTION).getFullList<Qualification>({
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

export function useCreateQualification() {
  return useMutationWithToast(
    (data: Partial<Qualification>) =>
      pb.collection(COLLECTION).create(data),
    {
      successMessage: "Đã thêm bằng cấp / chứng chỉ",
      invalidateKeys: [["qualifications"]],
    }
  );
}

export function useUpdateQualification() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<Qualification> }) =>
      pb.collection(COLLECTION).update(id, data),
    {
      successMessage: "Đã cập nhật bằng cấp / chứng chỉ",
      invalidateKeys: [["qualifications"]],
    }
  );
}

export function useDeleteQualification() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).delete(id),
    {
      successMessage: "Đã xóa bằng cấp / chứng chỉ",
      invalidateKeys: [["qualifications"]],
    }
  );
}
