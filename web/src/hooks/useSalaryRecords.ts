import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { SalaryRecord } from "@shared/types";

const COLLECTION = "salary_records";

export function useSalaryRecords(userId: string | undefined) {
  return useQuery({
    queryKey: ["salary_records", userId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection(COLLECTION).getFullList<SalaryRecord>({
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

export function useCreateSalaryRecord() {
  return useMutationWithToast(
    (data: Partial<SalaryRecord>) =>
      pb.collection(COLLECTION).create(data),
    {
      successMessage: "Đã thêm quá trình lương",
      invalidateKeys: [["salary_records"]],
    }
  );
}

export function useUpdateSalaryRecord() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<SalaryRecord> }) =>
      pb.collection(COLLECTION).update(id, data),
    {
      successMessage: "Đã cập nhật quá trình lương",
      invalidateKeys: [["salary_records"]],
    }
  );
}

export function useDeleteSalaryRecord() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION).delete(id),
    {
      successMessage: "Đã xóa quá trình lương",
      invalidateKeys: [["salary_records"]],
    }
  );
}
