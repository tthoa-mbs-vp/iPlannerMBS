import { useState, useRef, useMemo } from "react";
import { useNow } from "../../hooks/useNow";
import { X, FileText, Pencil, Trash2, Reply, Paperclip, Lock } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUsers } from "../../hooks/useDepartments";
import { useCommentsInfinite, useCreateComment, useUpdateComment, useDeleteComment } from "../../hooks/useComments";
import { useInfiniteChatScroll } from "../../hooks/useInfiniteChatScroll";
import {
  ChatComposer,
  ChatFilters,
  AttachmentDisplay,
  FilePreview,
  formatTime,
  highlightMentions,
  filterMessages,
  chatSenders,
  useFilePreview,
} from "../chat/chatShared";
import FilePreviewModal from "../shared/FilePreviewModal";
import type { Comment } from "@shared/types";

const ONE_HOUR = 60 * 60 * 1000;

function QuoteBlock({ comment }: { comment: Comment }) {
  const author = comment.expand?.user_id?.name || comment.expand?.user_id?.email || "—";
  const text = comment.content?.trim() || "";
  const fileNames = (comment.files || []).map((fn) => fn.split("_").pop() || fn);
  return (
    <div className="mb-1.5 rounded-r-lg border-l-2 border-indigo-300 bg-indigo-50/60 px-2.5 py-1.5 dark:border-indigo-700 dark:bg-indigo-900/40">
      <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">{author}</p>
      {text ? (
        <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap break-words dark:text-slate-300">{text}</p>
      ) : (
        <p className="text-xs italic text-slate-400 dark:text-slate-500">[Đính kèm tệp]</p>
      )}
      {fileNames.length > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
          <FileText className="h-3 w-3" />
          {fileNames.join(", ")}
        </p>
      )}
    </div>
  );
}

export default function CommentSection({ taskId, taskStatus }: {
  taskId: string;
  taskStatus?: string;
}) {
  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCommentsInfinite(taskId);
  const {
    listRef,
    items: comments,
    onScroll,
    scrollToBottom,
  } = useInfiniteChatScroll<Comment>({
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    resetKey: taskId,
  });
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const user = useAuthStore((s) => s.user);
  const { data: allUsers } = useUsers();

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const preview = useFilePreview();

  const [search, setSearch] = useState("");
  const [personFilters, setPersonFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredComments = useMemo(
    () => filterMessages(comments, search, personFilters, dateFrom, dateTo),
    [comments, search, personFilters, dateFrom, dateTo]
  );
  const hasActiveFilters = !!(search || personFilters.length > 0 || dateFrom || dateTo);

  const mentionUsers = allUsers?.filter((u) => u.id !== user?.id) || [];
  const personOptions = useMemo(() => chatSenders(comments, allUsers), [comments, allUsers]);

  const handleSend = async (content: string, files: File[]) => {
    await createComment.mutateAsync({
      data: { task_id: taskId, user_id: user?.id, content, quote_id: quoteId || undefined } as Partial<Comment> & { task_id: string; user_id?: string; content: string },
      files: files.length > 0 ? files : undefined,
      taskId,
    });
    setQuoteId(null);
    scrollToBottom();
  };

  const handleEditSave = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      await updateComment.mutateAsync({
        id,
        data: { content: editContent.trim() } as Partial<Comment> & { content: string },
        files: editFiles.length > 0 ? editFiles : undefined,
        taskId,
      });
      setEditingId(null);
      setEditContent("");
      setEditFiles([]);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa bình luận này?")) return;
    try { await deleteComment.mutateAsync({ id, taskId }); } catch (e) { console.error(e); }
  };

  const now = useNow();
  const canModify = (c: Comment) => user?.id === c.user_id && now - new Date(c.created).getTime() < ONE_HOUR;

  const locked = taskStatus === "completed" || taskStatus === "cancelled";
  const lockedMessage = taskStatus === "completed"
    ? "Nhiệm vụ đã hoàn thành — chỉ xem được bình luận đã có."
    : "Nhiệm vụ đã bị hủy — chỉ xem được bình luận đã có.";

  const quoted = quoteId ? comments.find((c) => c.id === quoteId) : undefined;
  const quoteBanner = quoteId ? (
    <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 dark:border-indigo-900/40 dark:bg-indigo-900/40">
      <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
          Trích dẫn từ {quoted?.expand?.user_id?.name || quoted?.expand?.user_id?.email || "—"}
        </p>
        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
          {quoted ? (quoted.content?.trim() || "[Đính kèm tệp]") : "Tin nhắn không tồn tại"}
        </p>
      </div>
      <button onClick={() => setQuoteId(null)} aria-label="Hủy trích dẫn"
        className="rounded p-0.5 text-slate-400 hover:text-red-500 transition-colors dark:text-slate-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : undefined;

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
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto space-y-3 px-5 pt-5">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-slate-400 dark:text-slate-500">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Đang tải bình luận cũ...
          </div>
        )}
        {!isPending && filteredComments.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            {hasActiveFilters ? "Không có bình luận phù hợp với bộ lọc" : "Chưa có bình luận"}
          </p>
        )}
        {filteredComments.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-900/40">
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3}
                className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" autoFocus />
              {editFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {editFiles.map((f, i) => (
                    <FilePreview key={f.name} file={f} onRemove={() => setEditFiles((prev) => prev.filter((_, j) => j !== i))} />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <button onClick={() => editFileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-blue-600 transition-colors dark:text-slate-300">
                  <Paperclip className="h-3.5 w-3.5" /> Đính kèm
                </button>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingId(null); setEditFiles([]); }}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 transition-colors dark:text-slate-300 dark:hover:bg-slate-700">Hủy</button>
                  <button onClick={() => handleEditSave(c.id)} disabled={!editContent.trim() || updateComment.isPending}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {updateComment.isPending ? "..." : "Lưu"}
                  </button>
                </div>
              </div>
              <input ref={editFileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  setEditFiles((prev) => [...prev, ...selected]);
                  e.target.value = "";
                }}
                className="hidden" />
            </div>
          ) : (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-white p-3 shadow-xs hover:shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-[10px] font-bold text-white">
                  {(c.expand?.user_id?.name || c.expand?.user_id?.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {c.expand?.user_id?.name || c.expand?.user_id?.email || "—"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 whitespace-nowrap dark:text-slate-500">{formatTime(c.created)}</span>
                      {!locked && (
                        <>
                      <button onClick={() => { setQuoteId(c.id); setFocusSignal((n) => n + 1); }}
                        className="rounded p-0.5 text-slate-300 hover:text-indigo-500 transition-colors dark:text-slate-500" title="Trích dẫn">
                        <Reply className="h-3 w-3" />
                      </button>
                      {canModify(c) && (
                        <>
                          <button onClick={() => { setEditingId(c.id); setEditContent(c.content); setEditFiles([]); }} aria-label="Chỉnh sửa bình luận"
                            className="rounded p-0.5 text-slate-300 hover:text-blue-500 transition-colors dark:text-slate-500">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} aria-label="Xóa bình luận"
                            className="rounded p-0.5 text-slate-300 hover:text-red-500 transition-colors dark:text-slate-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 whitespace-pre-wrap break-words dark:text-slate-300">
                    {highlightMentions(c.content)}
                  </p>
                  {c.expand?.quote_id && <QuoteBlock comment={c.expand.quote_id} />}
                  <AttachmentDisplay collection="comments" recordId={c.id} filenames={c.files || []} onPreview={preview.open} />
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {locked ? (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <p className="text-xs text-slate-500 dark:text-slate-300">{lockedMessage}</p>
        </div>
      ) : (
      <ChatComposer
        onSend={handleSend}
        mentionUsers={mentionUsers}
        placeholder="Nhập bình luận... (gõ @ để mention)"
        banner={quoteBanner}
        focusSignal={focusSignal}
        sending={createComment.isPending}
      />
      )}
      {preview.url && (
        <FilePreviewModal url={preview.url} filename={preview.filename} isImage={preview.isImage} onClose={preview.close} />
      )}
    </div>
  );
}
