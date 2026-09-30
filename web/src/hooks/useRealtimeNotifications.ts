import { useEffect } from "react";
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { useQueryClient } from "@tanstack/react-query";
import { getNotificationTypeLabel, decodeRef } from "./useNotifications";
import type { Notification } from "@shared/types";

export function useRealtimeNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const handler = (e: { action?: string; record?: Notification }) => {
      if (e.action === "create") {
        const record = e.record;
        if (record && record.user_id === userId) {
          const ref = decodeRef(record);
          const label = getNotificationTypeLabel(record.type);
          const msg = ref.message || label;
          addToast("info", msg);
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
      }
    };

    const unsubscribe = pb.collection("notifications").subscribe("*", handler, {
      filter: `user_id="${userId}"`,
    });

    // unsubscribe only THIS listener — unsubscribe("*") would tear down every
    // notification subscription (incl. a newer one from a re-mounted effect).
    return () => {
      unsubscribe.then((unsub) => unsub()).catch(() => {});
    };
  }, [userId, addToast, qc]);
}
