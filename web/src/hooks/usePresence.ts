import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { useMutationWithToast } from "./useMutationWithToast";
import type { PresenceCampaignResult, PresenceCampaignSummary, PresenceCheckEntry, PresentUser } from "@shared/types";

const HEARTBEAT_INTERVAL_MS = 30_000;

// ---- mobile app heartbeat ----
// Sends a heartbeat while the user is authenticated and the tab is visible/online.
// Mount once in the mobile layout; the server rate-limits (15s) so the 30s interval is safe.
export function usePresenceHeartbeat(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!userId) return;
    try {
      await pb.send("/api/custom/presence/heartbeat", {
        method: "POST",
        body: {
          device_info: navigator.userAgent?.slice(0, 255) || "",
        },
      });
    } catch {
      // silent: heartbeat is best-effort
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const fire = () => {
      if (navigator.onLine === false) return;
      sendHeartbeat();
    };
    fire();
    timerRef.current = setInterval(fire, HEARTBEAT_INTERVAL_MS);

    const onOnline = () => fire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fire();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, userId, sendHeartbeat]);
}

// ---- who is currently online ----
export function usePresentUsers(enabled = true) {
  return useQuery({
    queryKey: ["presence", "present"],
    queryFn: async () => {
      const res = await pb.send<{ present: PresentUser[] }>("/api/custom/presence/present", { method: "GET" });
      return res?.present || [];
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

// ---- campaigns ----
export function usePresenceCampaigns() {
  return useQuery({
    queryKey: ["presence", "campaigns"],
    queryFn: async () => {
      const res = await pb.send<{ campaigns: PresenceCampaignSummary[] }>("/api/custom/presence/campaigns", { method: "GET" });
      return res?.campaigns || [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useStartPresenceCampaign() {
  const qc = useQueryClient();
  return useMutationWithToast(
    ({ name, notes }: { name?: string; notes?: string }) =>
      pb.send<{ ok: boolean; id: string }>("/api/custom/presence/start", {
        method: "POST",
        body: { name, notes },
      }),
    {
      successMessage: "Đã kích hoạt đợt kiểm tra",
      invalidateKeys: [["presence", "campaigns"]],
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["presence", "present"] });
      },
    }
  );
}

export function useStopPresenceCampaign() {
  return useMutationWithToast(
    ({ id }: { id?: string }) =>
      pb.send<{ ok: boolean; id: string }>("/api/custom/presence/stop", {
        method: "POST",
        body: { id },
      }),
    {
      successMessage: "Đã đóng đợt kiểm tra",
      invalidateKeys: [["presence", "campaigns"]],
    }
  );
}

export function useRunPresenceCheck() {
  return useMutationWithToast(
    (id: string) =>
      pb.send<PresenceCampaignResult>("/api/custom/presence/run-check", {
        method: "POST",
        body: { id },
      }),
    {
      invalidateKeys: [["presence", "campaigns"], ["presence", "logs"]],
      onSuccess: (data) => {
        const message = `Đã kiểm tra: ${data?.responded ?? 0} có mặt / ${data?.absent ?? 0} vắng mặt`;
        useToastStore.getState().addToast("info", message);
      },
    }
  );
}

export function usePresenceCheckLogs(campaignId?: string) {
  return useQuery({
    queryKey: ["presence", "logs", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await pb.send<{ logs: PresenceCheckEntry[] }>(
        `/api/custom/presence/check-logs?campaign_id=${encodeURIComponent(campaignId)}`,
        { method: "GET" }
      );
      return res?.logs || [];
    },
    enabled: !!campaignId,
    staleTime: 15_000,
  });
}

export function useActivePresenceCampaign() {
  const { data: campaigns } = usePresenceCampaigns();
  return campaigns?.find((c) => c.status === "active") || null;
}
