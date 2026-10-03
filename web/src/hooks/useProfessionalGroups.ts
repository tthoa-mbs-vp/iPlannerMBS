import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "../hooks/useMutationWithToast";
import type { ProfessionalGroup } from "@shared/types";

/** See DepartmentInput: relation fields take an explicit null to clear. */
export type ProfessionalGroupInput = Omit<Partial<ProfessionalGroup>, "department_id"> & {
  department_id?: string | null;
};

export function useProfessionalGroups() {
  return useQuery({
    queryKey: ["professional_groups"],
    queryFn: () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("professional_groups").getFullList<ProfessionalGroup>({
        sort: "code",
        expand: "department_id",
      });
    },
    staleTime: 120_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateProfessionalGroup() {
  return useMutationWithToast(
    (data: ProfessionalGroupInput) => pb.collection("professional_groups").create(data),
    {
      successMessage: "Tạo tổ chuyên môn thành công",
      invalidateKeys: [["professional_groups"]],
    }
  );
}

export function useUpdateProfessionalGroup() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: ProfessionalGroupInput }) =>
      pb.collection("professional_groups").update(id, data),
    {
      successMessage: "Cập nhật tổ chuyên môn thành công",
      invalidateKeys: [["professional_groups"]],
    }
  );
}

export function useDeleteProfessionalGroup() {
  return useMutationWithToast(
    (id: string) => pb.collection("professional_groups").delete(id),
    {
      successMessage: "Xóa tổ chuyên môn thành công",
      invalidateKeys: [["professional_groups"]],
    }
  );
}
