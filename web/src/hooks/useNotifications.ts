import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useMutationWithToast } from "./useMutationWithToast";
import type { Notification } from "@shared/types";

function useUserId() {
  return useAuthStore((s) => s.user?.id);
}

export function useUnreadCount() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["notifications", "unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const result = await pb.collection("notifications").getList(1, 1, {
        filter: `user_id="${userId}" && is_read=false`,
      });
      return result.totalItems;
    },
    enabled: !!userId,
    staleTime: 15_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
    refetchInterval: 30_000,
  });
}

export function useNotifications(page = 1, perPage = 10, typeFilter?: string, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["notifications", userId, page, perPage, typeFilter],
    queryFn: async () => {
      if (!userId) return { items: [], totalItems: 0 };
      let filter = `user_id="${userId}"`;
      if (typeFilter) filter += ` && type="${typeFilter}"`;
      return pb.collection("notifications").getList<Notification>(page, perPage, {
        filter,
        sort: "-created",
      });
    },
    enabled: !!userId && enabled,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useMarkAsRead() {
  return useMutationWithToast(
    (id: string) => pb.collection("notifications").update(id, { is_read: true }),
    {
      invalidateKeys: [["notifications"], ["notifications", "unread-count"]],
    }
  );
}

export function useMarkAllAsRead() {
  const userId = useUserId();
  return useMutationWithToast(
    async () => {
      if (!userId) return;
      // PocketBase doesn't support bulk-update, so paginate through unread
      // notifications and batch-update each page to avoid fetching the full
      // list into memory when there are thousands.
      const PAGE = 100;
      let page = 1;
      let total = Infinity;
      while ((page - 1) * PAGE < total) {
        const result = await pb.collection("notifications").getList(page, PAGE, {
          filter: `user_id="${userId}" && is_read=false`,
          fields: "id",
        });
        total = result.totalItems;
        if (result.items.length === 0) break;
        await Promise.all(
          result.items.map((n) => pb.collection("notifications").update(n.id, { is_read: true }))
        );
        page++;
      }
    },
    {
      successMessage: "Đã đánh dấu tất cả là đã đọc",
      invalidateKeys: [["notifications"], ["notifications", "unread-count"]],
    }
  );
}

export function decodeRef(n: Notification): { taskId?: string; taskName?: string; announcementId?: string; title?: string; message: string } {
  const ref = n.reference_id || "";
  if (ref.startsWith("{")) {
    try {
      const parsed = JSON.parse(ref);
      return {
        ...parsed,
        message: parsed.message || getNotificationTypeLabel(n.type),
      };
    } catch {
      // fall through to new format
    }
  }
  const idx = ref.indexOf("-");
  if (idx > 0) {
    return {
      taskId: ref.substring(0, idx),
      taskName: ref.substring(idx + 1),
      message: getNotificationTypeLabel(n.type),
    };
  }
  return { message: ref };
}

const TYPE_PREFIX: Record<string, string> = {
  mention: "Đề cập",
  reply: "Trả lời",
  deadline_warning: "Hạn chót",
  task_update: "Cập nhật",
  proposal_update: "Đề xuất",
  announcement: "Thông báo",
  surprise_check: "Kiểm tra đột xuất",
};

export function getNotificationTypeLabel(type: string): string {
  return TYPE_PREFIX[type] || type;
}

export function getNotificationLink(n: Notification): string {
  const ref = decodeRef(n);
  if (ref.announcementId) return `/announcements/${ref.announcementId}`;
  if (ref.taskId) return `/tasks/${ref.taskId}`;
  return "#";
}
