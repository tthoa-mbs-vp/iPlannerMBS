import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useMutationWithToast } from "./useMutationWithToast";
import type { AttendanceLog, AttendanceConfig } from "@shared/types";

const COLLECTION = "attendance_logs";
const CONFIG_COLLECTION = "attendance_configs";

export function useAttendanceLogs(userId?: string, days = 180) {
  return useQuery({
    queryKey: ["attendance_logs", userId, days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString();
      const filters = [`check_in >= "${sinceStr}"`];
      if (userId) filters.push(`user_id="${userId}"`);
      return pb.collection(COLLECTION).getFullList<AttendanceLog>({
        sort: "-check_in",
        filter: filters.join(" && "),
        expand: "user_id",
      });
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useAttendanceConfigs() {
  return useQuery({
    queryKey: ["attendance_configs"],
    queryFn: async () => {
      return pb.collection(CONFIG_COLLECTION).getFullList<AttendanceConfig>({
        sort: "office_name",
      });
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateAttendanceConfig() {
  return useMutationWithToast(
    (data: Partial<AttendanceConfig>) =>
      pb.collection(CONFIG_COLLECTION).create(data),
    {
      successMessage: "Đã thêm cấu hình WiFi chấm công",
      invalidateKeys: [["attendance_configs"]],
    }
  );
}

export function useUpdateAttendanceConfig() {
  return useMutationWithToast(
    ({ id, data }: { id: string; data: Partial<AttendanceConfig> }) =>
      pb.collection(CONFIG_COLLECTION).update(id, data),
    {
      successMessage: "Đã cập nhật cấu hình WiFi chấm công",
      invalidateKeys: [["attendance_configs"]],
    }
  );
}

export function useDeleteAttendanceConfig() {
  return useMutationWithToast(
    (id: string) => pb.collection(CONFIG_COLLECTION).delete(id),
    {
      successMessage: "Đã xóa cấu hình WiFi",
      invalidateKeys: [["attendance_configs"]],
    }
  );
}

interface WifiCheckInPayload {
  user_id?: string;
  ssid: string;
  bssid?: string;
  ip_address?: string;
  notes?: string;
  config?: AttendanceConfig;
}

export function useCheckIn() {
  return useMutationWithToast(
    async (payload: WifiCheckInPayload) => {
      const now = new Date();
      let status: "on_time" | "late" = "on_time";

      // Calculate status based on work_start_time and late_tolerance_minutes
      if (payload.config) {
        const [startHour, startMinute] = payload.config.work_start_time
          .split(":")
          .map(Number);
        const tolerance = payload.config.late_tolerance_minutes || 15;

        const startThreshold = new Date(now);
        startThreshold.setHours(startHour, startMinute + tolerance, 0, 0);

        if (now > startThreshold) {
          status = "late";
        }
      } else {
        // Fallback default: 08:15
        if (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 15)) {
          status = "late";
        }
      }

      const deviceInfo = `${navigator.userAgent.slice(0, 100)} | Platform: ${navigator.platform}`;

      const logData: Partial<AttendanceLog> = {
        user_id: payload.user_id,
        check_in: now.toISOString(),
        method: "wifi",
        status,
        device_info: deviceInfo,
        notes: `WiFi: ${payload.ssid}${payload.ip_address ? ` (IP: ${payload.ip_address})` : ""}${
          payload.notes ? ` | ${payload.notes}` : ""
        }`,
      };

      return pb.collection(COLLECTION).create(logData);
    },
    {
      successMessage: "Chấm công vào ca qua WiFi thành công",
      invalidateKeys: [["attendance_logs"]],
    }
  );
}

export function useCheckOut() {
  return useMutationWithToast(
    (id: string) =>
      pb.collection(COLLECTION).update(id, {
        check_out: new Date().toISOString(),
      }),
    {
      successMessage: "Chấm công ra ca thành công",
      invalidateKeys: [["attendance_logs"]],
    }
  );
}
