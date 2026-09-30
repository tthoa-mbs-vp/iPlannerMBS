import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { EmployeeProfile } from "@shared/types";

/** PocketBase throws ClientResponseError; only the status is needed here. */
function statusOf(e: unknown): number | undefined {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status?: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

export function useEmployeeProfiles() {
  return useQuery({
    queryKey: ["employee_profiles"],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("employee_profiles").getFullList<EmployeeProfile>({
        sort: "-created",
      });
    },
    staleTime: 120_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useEmployeeProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["employee_profiles", userId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      if (!userId) return null;
      try {
        const result = await pb
          .collection("employee_profiles")
          .getFirstListItem<EmployeeProfile>(`user_id="${userId}"`, {
            expand: "user_id,user_id.department_id,user_id.role_id",
          });
        return result;
      } catch (e: unknown) {
        if (statusOf(e) === 404) return null;
        throw e;
      }
    },
    enabled: !!userId,
    staleTime: 120_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useUpsertEmployeeProfile() {
  return useMutationWithToast(
    async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<EmployeeProfile>;
    }) => {
      return pb.send("/api/custom/upsert-employee-profile", {
        method: "POST",
        body: { userId, data },
      });
    },
    {
      successMessage: "Cập nhật hồ sơ nhân sự thành công",
      invalidateKeys: [["employee_profiles"]],
    }
  );
}
