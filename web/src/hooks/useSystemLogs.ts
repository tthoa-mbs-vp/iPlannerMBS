import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import type { SystemLog } from "@shared/types";

export function useSystemLogs(page = 1, perPage = 50) {
  return useQuery({
    queryKey: ["system_logs", page, perPage],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("system_logs").getList<SystemLog>(page, perPage, {
        sort: "-created",
        expand: "user_id",
      });
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}
