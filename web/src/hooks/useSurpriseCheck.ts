import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";

// --- Types (local, matching backend API) ---

interface ActiveCheck {
  id: string;
  name: string;
  notes?: string;
  started_at: string;
  started_by?: string;
  response_window_minutes: number;
  responded: boolean;
  responded_at?: string;
}

interface CheckResult {
  user_id: string;
  user_name: string;
  department: string;
  responded: boolean;
  responded_at?: string;
  device_info?: string;
}

interface CampaignResults {
  campaign: {
    id: string;
    name: string;
    status: string;
    started_at: string;
    ended_at?: string;
    notes?: string;
  };
  total: number;
  responded: number;
  not_responded: number;
  details: CheckResult[];
}

// --- User hooks ---

/** Polls for active surprise check (polling fallback + realtime subscription) */
export function useActiveSurpriseCheck() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["surprise-check", "active", userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const res = await pb.send<{ active: ActiveCheck | null }>(
          "/api/surprise-check/active",
          {}
        );
        return res.active;
      } catch {
        return null;
      }
    },
    enabled: !!userId,
    refetchInterval: 10_000, // poll every 10s as fallback
    staleTime: 5_000,
  });
}

/** Subscribe to real-time surprise check notifications via PocketBase realtime */
export function useSurpriseCheckRealtime(onNewCheck?: () => void) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const unsubscribePromise = pb.realtime.subscribe(
      `presence_check_logs`,
      () => {
        qc.invalidateQueries({ queryKey: ["surprise-check", "active"] });
        qc.invalidateQueries({ queryKey: ["surprise-check", "results"] });
        onNewCheck?.();
      },
      { filter: `user_id="${userId}"` }
    );

    let unsubscribed = false;
    void unsubscribePromise.then((unsub) => {
      if (!unsubscribed && typeof unsub === "function") {
        unsubFn = unsub;
      }
    });

    let unsubFn: (() => void) | null = null;

    return () => {
      unsubscribed = true;
      unsubFn?.();
    };
  }, [userId, qc, onNewCheck]);
}

/** Respond to a surprise check */
export function useRespondToCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      password,
      method,
    }: {
      campaignId: string;
      password?: string;
      method?: "password" | "biometric";
    }) => {
      const res = await pb.send<{ ok: boolean; message: string; responded_at: string }>(
        "/api/surprise-check/respond",
        {
          method: "POST",
          body: {
            campaign_id: campaignId,
            password: password || "",
            method: method || "password",
            device_info: navigator.userAgent.slice(0, 100),
          },
        }
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surprise-check", "active"] });
    },
  });
}

// --- Admin hooks ---

/** Start a surprise check campaign */
export function useStartSurpriseCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      notes,
      targetUserIds,
      windowMinutes,
    }: {
      name?: string;
      notes?: string;
      targetUserIds?: string[];
      windowMinutes?: number;
    }) => {
      const res = await pb.send<{
        ok: boolean;
        campaign_id: string;
        total_users: number;
        window_minutes: number;
      }>("/api/surprise-check/start", {
        method: "POST",
        body: {
          name: name || "Kiểm tra đột xuất",
          notes: notes || "",
          target_user_ids: targetUserIds || [],
          response_window_minutes: windowMinutes || 15,
        },
      });
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surprise-check"] });
    },
  });
}

/** Close active campaign */
export function useCloseSurpriseCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId?: string) => {
      const res = await pb.send<{ ok: boolean; closed: number }>(
        "/api/surprise-check/close",
        {
          method: "POST",
          body: { campaign_id: campaignId || "" },
        }
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surprise-check"] });
    },
  });
}

/** Get campaign results */
export function useSurpriseCheckResults(campaignId: string) {
  return useQuery({
    queryKey: ["surprise-check", "results", campaignId],
    queryFn: async () => {
      const res = await pb.send<CampaignResults>(
        `/api/surprise-check/results/${campaignId}`,
        {}
      );
      return res;
    },
    enabled: !!campaignId,
    staleTime: 5_000,
    refetchInterval: 5_000, // auto-refresh while viewing results
  });
}

/** Subscribe to realtime updates for campaign results */
export function useSurpriseCheckResultsRealtime(campaignId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!campaignId) return;

    const unsubscribePromise = pb.realtime
      .subscribe("presence_check_logs", () => {
        qc.invalidateQueries({ queryKey: ["surprise-check", "results"] });
      });

    let unsubscribed = false;
    let unsubFn: (() => void) | null = null;
    void unsubscribePromise.then((unsub) => {
      if (!unsubscribed && typeof unsub === "function") {
        unsubFn = unsub;
      }
    });

    return () => {
      unsubscribed = true;
      unsubFn?.();
    };
  }, [campaignId, qc]);
}

/** Get active campaigns for admin panel */
export function useActiveCampaigns() {
  return useQuery({
    queryKey: ["surprise-check", "campaigns"],
    queryFn: async () => {
      const campaigns = await pb.collection("presence_campaigns").getFullList({
        sort: "-started_at",
        filter: 'status="active"',
      });
      return campaigns;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}
