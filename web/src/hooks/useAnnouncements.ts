import { useQuery } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { useMutationWithToast } from "./useMutationWithToast";
import type { Announcement } from "@shared/types";

export function useAnnouncements() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["announcements", userId],
    queryFn: async () => {
      if (!userId) return [];
      const result = await pb.collection("announcements").getFullList<Announcement>({
        sort: "-is_pinned,-created",
        expand: "author_id",
        requestKey: "announcements-full",
      });
      return result;
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateAnnouncement(userId?: string) {
  return useMutationWithToast(
    (data: { title: string; content: string; is_pinned: boolean; is_active: boolean; published_at?: string }) =>
      pb.collection("announcements").create<Announcement>({
        ...data,
        author_id: userId,
      }),
    {
      successMessage: "Đã đăng thông báo",
      invalidateKeys: [["announcements"]],
    }
  );
}

export function useUpdateAnnouncement() {
  return useMutationWithToast(
    (data: { id: string; title: string; content: string; is_pinned: boolean; is_active: boolean }) =>
      pb.collection("announcements").update<Announcement>(data.id, {
        title: data.title,
        content: data.content,
        is_pinned: data.is_pinned,
        is_active: data.is_active,
      }),
    {
      successMessage: "Đã cập nhật thông báo",
      invalidateKeys: [["announcements"]],
    }
  );
}

export function useDeleteAnnouncement() {
  return useMutationWithToast(
    (id: string) => pb.collection("announcements").delete(id),
    {
      successMessage: "Đã xóa thông báo",
      invalidateKeys: [["announcements"]],
    }
  );
}
