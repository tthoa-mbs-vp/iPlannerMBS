import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useToastStore } from "../stores/toastStore";
import type { Comment } from "@shared/types";

const THREAD_PAGE_SIZE = 30;

function threadKey(taskId: string) {
  return ["comments", "thread", taskId];
}

function prependComment(qc: ReturnType<typeof useQueryClient>, taskId: string, c: Comment) {
  qc.setQueryData(threadKey(taskId), (old: { pages: Comment[][] } | undefined) => {
    if (!old) return old;
    const exists = old.pages.some((p) => p.some((x) => x.id === c.id));
    if (exists) return old;
    return { ...old, pages: [[c, ...(old.pages[0] || [])], ...old.pages.slice(1)] };
  });
}

function removeComment(qc: ReturnType<typeof useQueryClient>, taskId: string, id: string) {
  qc.setQueryData(threadKey(taskId), (old: { pages: Comment[][] } | undefined) => {
    if (!old) return old;
    const pages = old.pages.map((p) => p.filter((c) => c.id !== id)).filter((p) => p.length > 0);
    return { ...old, pages };
  });
}

function mergeComment(qc: ReturnType<typeof useQueryClient>, taskId: string, c: Comment) {
  qc.setQueryData(threadKey(taskId), (old: { pages: Comment[][] } | undefined) => {
    if (!old) return old;
    const pages = old.pages.map((p) => p.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
    return { ...old, pages };
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const records = await pb.collection("comments").getFullList<Comment>(100, {
        filter: `task_id="${taskId}"`,
        sort: "-created",
        expand: "user_id,quote_id.user_id",
      });
      return records;
    },
    enabled: !!taskId,
    staleTime: 10_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCommentsInfinite(taskId: string) {
  return useInfiniteQuery({
    queryKey: ["comments", "thread", taskId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const list = await pb.collection("comments").getList<Comment>(pageParam, THREAD_PAGE_SIZE, {
        filter: `task_id="${taskId}"`,
        sort: "-created",
        expand: "user_id,quote_id.user_id",
      });
      return list.items;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage && lastPage.length >= THREAD_PAGE_SIZE ? allPages.length + 1 : undefined,
    enabled: !!taskId,
    staleTime: 10_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useAllComments() {
  return useQuery({
    queryKey: ["comments", "all"],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      return pb.collection("comments").getFullList<Comment>(200, {
        sort: "-created",
        expand: "user_id",
      });
    },
    staleTime: 10_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

export function useCreateComment() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data, files: fileList }: { data: Partial<Comment>; files?: File[]; taskId?: string }) => {
      return pb.collection("comments").create({
        ...data,
        files: fileList && fileList.length > 0 ? fileList : undefined,
      });
    },
    onSuccess: async (res, vars) => {
      addToast("success", "Thêm bình luận thành công");
      if (vars.taskId) {
        await qc.invalidateQueries({ queryKey: ["comments", vars.taskId] });
        try {
          const full = await pb.collection("comments").getOne<Comment>(res.id, { expand: "user_id,quote_id.user_id" });
          prependComment(qc, vars.taskId, full);
        } catch {
          prependComment(qc, vars.taskId, res as unknown as Comment);
        }
      }
    },
    onError: (error: any) => {
      addToast("error", error instanceof Error ? error.message : "Có lỗi xảy ra");
    },
  });
}

export function useUpdateComment() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, files: fileList }: { id: string; data: Partial<Comment>; files?: File[]; taskId?: string }) => {
      return pb.collection("comments").update(id, {
        ...data,
        files: fileList && fileList.length > 0 ? fileList : undefined,
      });
    },
    onSuccess: async (res, vars) => {
      addToast("success", "Cập nhật bình luận thành công");
      if (vars.taskId) {
        await qc.invalidateQueries({ queryKey: ["comments", vars.taskId] });
        mergeComment(qc, vars.taskId, res as unknown as Comment);
      }
    },
    onError: (error: any) => {
      addToast("error", error instanceof Error ? error.message : "Có lỗi xảy ra");
    },
  });
}

export function useDeleteComment() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; taskId?: string }) => pb.collection("comments").delete(id),
    onSuccess: async (_res, vars) => {
      addToast("success", "Xóa bình luận thành công");
      if (vars.taskId) {
        await qc.invalidateQueries({ queryKey: ["comments", vars.taskId] });
        removeComment(qc, vars.taskId, vars.id);
      }
    },
    onError: (error: any) => {
      addToast("error", error instanceof Error ? error.message : "Có lỗi xảy ra");
    },
  });
}
