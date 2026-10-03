import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../api/client";
import { useToastStore } from "../stores/toastStore";
import { errorMessage } from "../utils/errors";
import type { ChatMessage } from "@shared/types";

export type ChannelRef =
  | { type: "org" }
  | { type: "department"; deptId: string }
  | { type: "group"; groupId: string };

export function channelKey(ch: ChannelRef): string {
  if (ch.type === "org") return "org";
  if (ch.type === "department") return `dept:${ch.deptId}`;
  return `group:${ch.groupId}`;
}

function channelFilter(ch: ChannelRef): string {
  if (ch.type === "org") return 'channel_type="org"';
  if (ch.type === "department") return `channel_type="department" && channel_dept_id="${ch.deptId}"`;
  return `channel_type="group" && channel_group_id="${ch.groupId}"`;
}

const PAGE_SIZE = 30;

export function useChannelMessages(ch: ChannelRef | null) {
  return useInfiniteQuery({
    queryKey: ["chat_messages", ch ? channelKey(ch) : "none"],
    queryFn: async ({ pageParam = 1 }) => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const list = await pb.collection("chat_messages").getList<ChatMessage>(pageParam, PAGE_SIZE, {
        filter: channelFilter(ch!),
        sort: "-created",
        expand: "user_id",
      });
      return list.items;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage && lastPage.length >= PAGE_SIZE ? allPages.length + 1 : undefined,
    enabled: !!ch,
    staleTime: 10_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
  });
}

function recordMatchesChannel(r: ChatMessage, ch: ChannelRef): boolean {
  if (ch.type === "org") return r.channel_type === "org";
  if (ch.type === "department") return r.channel_type === "department" && r.channel_dept_id === ch.deptId;
  return r.channel_type === "group" && r.channel_group_id === ch.groupId;
}

function chatQueryKey(ch: ChannelRef) {
  return ["chat_messages", channelKey(ch)];
}

function prependMessage(qc: ReturnType<typeof useQueryClient>, ch: ChannelRef, msg: ChatMessage) {
  qc.setQueryData(chatQueryKey(ch), (old: { pages: ChatMessage[][] } | undefined) => {
    if (!old) return old;
    const exists = old.pages.some((p) => p.some((m) => m.id === msg.id));
    if (exists) return old;
    return { ...old, pages: [[msg, ...(old.pages[0] || [])], ...old.pages.slice(1)] };
  });
}

function removeMessage(qc: ReturnType<typeof useQueryClient>, ch: ChannelRef, id: string) {
  qc.setQueryData(chatQueryKey(ch), (old: { pages: ChatMessage[][] } | undefined) => {
    if (!old) return old;
    const pages = old.pages.map((p) => p.filter((m) => m.id !== id)).filter((p) => p.length > 0);
    return { ...old, pages };
  });
}

export function useCreateChatMessage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ch, content, files: fileList }: { ch: ChannelRef; content: string; files?: File[] }) => {
      return pb.collection("chat_messages").create({
        // The createRule requires @request.auth.id = user_id; the server hook (guards.pb.js)
        // also overwrites user_id from the session, so this value can never be spoofed.
        user_id: pb.authStore.record?.id,
        channel_type: ch.type,
        channel_dept_id: ch.type === "department" ? ch.deptId : undefined,
        channel_group_id: ch.type === "group" ? ch.groupId : undefined,
        content,
        files: fileList && fileList.length > 0 ? fileList : undefined,
      });
    },
    onSuccess: async (res, vars) => {
      addToast("success", "Gửi tin nhắn thành công");
      try {
        const full = await pb.collection("chat_messages").getOne<ChatMessage>(res.id, { expand: "user_id" });
        prependMessage(qc, vars.ch, full);
      } catch {
        prependMessage(qc, vars.ch, res as unknown as ChatMessage);
      }
    },
    onError: (error: unknown) => {
      addToast("error", errorMessage(error));
    },
  });
}

export function useDeleteChatMessage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; ch: ChannelRef }) => pb.collection("chat_messages").delete(id),
    onSuccess: async (_res, vars) => {
      addToast("success", "Xóa tin nhắn thành công");
      removeMessage(qc, vars.ch, vars.id);
    },
    onError: (error: unknown) => {
      addToast("error", errorMessage(error));
    },
  });
}

export function useChatRealtime(ch: ChannelRef | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ch) return;
    const handler = async (e: { record?: ChatMessage; action?: string }) => {
      const rec = e.record;
      if (!rec || !recordMatchesChannel(rec, ch)) return;
      if (e.action === "create") {
        try {
          const full = await pb.collection("chat_messages").getOne<ChatMessage>(rec.id, { expand: "user_id" });
          prependMessage(qc, ch, full);
        } catch {
          prependMessage(qc, ch, rec);
        }
      } else if (e.action === "delete") {
        removeMessage(qc, ch, rec.id);
      }
    };
    const subscription = pb.collection("chat_messages").subscribe("*", handler);
    return () => {
      subscription.then((unsub) => unsub()).catch(() => {});
    };
  }, [ch, qc]);
}
