import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { LeaveRequest, LeaveBalance } from "@shared/types";

const COLLECTION_LEAVE = "leave_requests";
const COLLECTION_BALANCE = "leave_balances";

export function useLeaveRequests(scope: "personal" | "all" = "all", userId?: string) {
  return useQuery({
    queryKey: ["leave_requests", scope, userId],
    queryFn: async () => {
      const filter = scope === "personal" && userId ? `user_id="${userId}"` : "";
      return pb.collection(COLLECTION_LEAVE).getFullList<LeaveRequest>({
        sort: "-created",
        filter,
        expand: "user_id,approver_id",
      });
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useLeaveBalance(userId?: string, year = new Date().getFullYear()) {
  return useQuery({
    queryKey: ["leave_balances", userId, year],
    queryFn: async () => {
      if (!userId) return null;
      const records = await pb.collection(COLLECTION_BALANCE).getFullList<LeaveBalance>({
        filter: `user_id="${userId}" && year=${year}`,
      });
      return records[0] || null;
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateLeaveRequest() {
  return useMutationWithToast(
    (data: Partial<LeaveRequest>) =>
      pb.collection(COLLECTION_LEAVE).create({
        ...data,
        status: "pending",
      }),
    {
      successMessage: "Tạo đơn xin nghỉ phép thành công",
      invalidateKeys: [["leave_requests"], ["leave_balances"]],
    }
  );
}

export function useUpdateLeaveRequest() {
  return useMutationWithToast(
    ({ id, ...data }: { id: string } & Partial<LeaveRequest>) =>
      pb.collection(COLLECTION_LEAVE).update(id, data),
    {
      successMessage: "Cập nhật đơn nghỉ phép thành công",
      invalidateKeys: [["leave_requests"], ["leave_balances"]],
    }
  );
}

export function useUpdateLeaveStatus() {
  return useMutationWithToast(
    (payload: { id: string; status: LeaveRequest["status"]; approver_id?: string; rejection_reason?: string }) =>
      pb.send("/api/custom/approve-leave", {
        method: "POST",
        body: {
          id: payload.id,
          action: payload.status === "approved" ? "approve" : "reject",
          rejection_reason: payload.rejection_reason,
        },
      }),
    {
      successMessage: "Cập nhật trạng thái đơn nghỉ phép thành công",
      invalidateKeys: [["leave_requests"], ["leave_balances"]],
    }
  );
}

export function useDeleteLeaveRequest() {
  return useMutationWithToast(
    (id: string) => pb.collection(COLLECTION_LEAVE).delete(id),
    {
      successMessage: "Xóa đơn xin nghỉ phép thành công",
      invalidateKeys: [["leave_requests"], ["leave_balances"]],
    }
  );
}
