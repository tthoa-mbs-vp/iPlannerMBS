import { useState, useMemo } from "react";
import { useNow } from "../../hooks/useNow";
import { Trash2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUsers } from "../../hooks/useDepartments";
import {
  useChannelMessages,
  useCreateChatMessage,
  useDeleteChatMessage,
  useChatRealtime,
  channelKey,
  type ChannelRef,
} from "../../hooks/useChatMessages";
import { useInfiniteChatScroll } from "../../hooks/useInfiniteChatScroll";
import {
  ChatComposer,
  ChatFilters,
  AttachmentDisplay,
  formatTime,
  highlightMentions,
  filterMessages,
  chatSenders,
  useFilePreview,
} from "./chatShared";
import FilePreviewModal from "../shared/FilePreviewModal";
import type { ChatMessage } from "@shared/types";

const ONE_HOUR = 60 * 60 * 1000;

export default function ChannelChat({ channel }: { channel: ChannelRef }) {
  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useChannelMessages(channel);
  const {
    listRef,
    items: messages,
    onScroll,
    scrollToBottom,
  } = useInfiniteChatScroll<ChatMessage>({
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    resetKey: channelKey(channel),
  });
  const createMessage = useCreateChatMessage();
  const deleteMessage = useDeleteChatMessage();
  const user = useAuthStore((s) => s.user);
  const { data: allUsers } = useUsers();
  useChatRealtime(channel);

  const [search, setSearch] = useState("");
  const [personFilters, setPersonFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const chKey = channelKey(channel);
  const [prevChKey, setPrevChKey] = useState(chKey);
  if (prevChKey !== chKey) {
    setPrevChKey(chKey);
    setSearch("");
    setPersonFilters([]);
    setDateFrom("");
    setDateTo("");
  }

  const filteredMessages = useMemo(
    () => filterMessages(messages, search, personFilters, dateFrom, dateTo),
    [messages, search, personFilters, dateFrom, dateTo]
  );
  const hasActiveFilters = !!(search || personFilters.length > 0 || dateFrom || dateTo);

  const preview = useFilePreview();

  const mentionUsers = allUsers?.filter((u) => u.id !== user?.id) || [];

  const personOptions = useMemo(() => chatSenders(messages, allUsers), [messages, allUsers]);

  const handleSend = async (content: string, files: File[]) => {
    await createMessage.mutateAsync({
      ch: channel,
      content,
      files: files.length > 0 ? files : undefined,
    });
    scrollToBottom();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa tin nhắn này?")) return;
    try { await deleteMessage.mutateAsync({ id, ch: channel }); } catch (e) { console.error(e); }
  };

  const now = useNow();
  const canDelete = (m: ChatMessage) =>
    user?.id === m.user_id && now - new Date(m.created).getTime() < ONE_HOUR;

  return (
    <div className="relative flex flex-col h-full">
      <ChatFilters
        search={search}
        onSearchChange={setSearch}
        personFilters={personFilters}
        onPersonToggle={(id) => setPersonFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        personOptions={personOptions}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClear={() => { setSearch(""); setPersonFilters([]); setDateFrom(""); setDateTo(""); }}
      />
      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-400 dark:text-slate-500">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Đang tải tin nhắn cũ...
          </div>
        )}
        {isPending && <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Đang tải tin nhắn...</p>}
        {!isPending && filteredMessages.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            {hasActiveFilters ? "Không có tin nhắn phù hợp với bộ lọc" : "Chưa có tin nhắn. Hãy bắt đầu trao đổi!"}
          </p>
        )}
        {filteredMessages.map((m) => {
          const mine = m.user_id === user?.id;
          const author = m.expand?.user_id?.name || m.expand?.user_id?.email || "—";
          return (
            <div key={m.id} className={`flex items-start gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-[10px] font-bold text-white">
                {author[0].toUpperCase()}
              </div>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 shadow-xs ${mine ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white border border-slate-100 rounded-tl-none dark:bg-slate-800 dark:border-slate-700"}`}>
                <div className={`flex items-center gap-2 ${mine ? "justify-between flex-row-reverse" : ""}`}>
                  <span className={`text-xs font-semibold ${mine ? "text-indigo-100" : "text-slate-700 dark:text-slate-200"}`}>{mine ? "Bạn" : author}</span>
                  <span className={`text-[10px] whitespace-nowrap ${mine ? "text-indigo-200" : "text-slate-400 dark:text-slate-400"}`}>{formatTime(m.created)}</span>
                </div>
                {m.content && (
                  <p className={`mt-0.5 text-sm whitespace-pre-wrap break-words ${mine ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>
                    {highlightMentions(m.content)}
                  </p>
                )}
                <AttachmentDisplay collection="chat_messages" recordId={m.id} filenames={m.files || []} onPreview={preview.open} />
                {mine && canDelete(m) && (
                  <div className="mt-1 text-right">
                    <button onClick={() => handleDelete(m.id)}
                      className={`rounded p-0.5 transition-colors ${mine ? "text-indigo-200 hover:text-white" : "text-slate-300 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-300"}`}
                      title="Xóa tin nhắn">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ChatComposer
        onSend={handleSend}
        mentionUsers={mentionUsers}
        placeholder="Nhập tin nhắn... (gõ @ để mention)"
        sending={createMessage.isPending}
      />
      {preview.url && (
        <FilePreviewModal url={preview.url} filename={preview.filename} isImage={preview.isImage} onClose={preview.close} />
      )}
    </div>
  );
}
