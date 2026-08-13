import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Send, Paperclip, X, FileText, Download, Maximize2, Filter, Search } from "lucide-react";
import { getFileUrl } from "../../api/client";
import CheckCombobox from "../shared/CheckCombobox";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return d.toLocaleString("vi-VN");
}

export function highlightMentions(text: string): ReactNode {
  const parts = text.split(/(@[\wÀ-ỹ]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-medium text-indigo-600 bg-indigo-50 rounded px-0.5 dark:text-indigo-300 dark:bg-indigo-950/50">{part}</span>
    ) : (
      part
    )
  );
}

export function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith("image/");
  const objectUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
      {isImage && objectUrl ? (
        <img src={objectUrl} alt="" className="h-8 w-8 rounded object-cover" />
      ) : (
        <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      )}
      <span className="max-w-[120px] truncate text-xs text-slate-600 dark:text-slate-300" title={file.name}>{file.name}</span>
      <button onClick={onRemove} aria-label="Xóa tệp đính kèm" className="ml-auto rounded p-0.5 text-slate-400 hover:text-red-500 transition-colors dark:text-slate-500 dark:hover:text-red-300">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface AttachmentDisplayProps {
  collection: string;
  recordId: string;
  filenames: string[];
  onPreview: (url: string, filename: string, isImage: boolean) => void;
}

export function AttachmentDisplay({ collection, recordId, filenames, onPreview }: AttachmentDisplayProps) {
  if (!filenames || filenames.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {filenames.map((fn) => {
        const url = getFileUrl(collection, recordId, fn);
        const isImage = IMAGE_TYPES.some((t) => fn.toLowerCase().endsWith(t.split("/")[1]));
        const displayName = fn.split("_").pop() || fn;
        if (isImage) {
          return (
            <button key={fn} onClick={() => onPreview(url, fn, true)}
              className="group relative overflow-hidden rounded-lg border border-slate-200 cursor-zoom-in dark:border-slate-700">
              <img src={url + "?thumb=150x150"} alt=""
                className="h-16 w-16 object-cover transition-transform group-hover:scale-110"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        }
        const isPreviewable = fn.match(/\.(pdf|docx?|xlsx?)$/i);
        return (
          <div key={fn} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <a href={url} target="_blank" rel="noopener noreferrer" download={displayName}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors rounded-l-lg dark:text-slate-300 dark:hover:bg-slate-700">
              <Download className="h-3.5 w-3.5" />
              {displayName}
            </a>
            {isPreviewable && (
              <button onClick={() => onPreview(url, fn, false)}
                className="rounded-r-lg px-1.5 py-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors dark:text-slate-500 dark:hover:text-indigo-300 dark:hover:bg-slate-700" title="Xem trước">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FilePreviewState {
  url: string | null;
  filename: string;
  isImage: boolean;
  open: (url: string, filename: string, isImage: boolean) => void;
  close: () => void;
}

export function useFilePreview(): FilePreviewState {
  const [url, setUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [isImage, setIsImage] = useState(false);
  const open = useCallback((u: string, f: string, img: boolean) => {
    setUrl(u);
    setFilename(f);
    setIsImage(img);
  }, []);
  const close = useCallback(() => setUrl(null), []);
  return { url, filename, isImage, open, close };
}

interface MentionUser {
  id: string;
  name?: string;
  email?: string;
}

interface ChatComposerProps {
  onSend: (content: string, files: File[]) => void | Promise<void>;
  mentionUsers: MentionUser[];
  placeholder?: string;
  banner?: ReactNode;
  sending?: boolean;
  focusSignal?: number;
}

export function ChatComposer({ onSend, mentionUsers, placeholder = "Nhập tin nhắn... (gõ @ để mention)", banner, sending, focusSignal }: ChatComposerProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMentions = mentionQuery
    ? mentionUsers.filter((u) => (u.name || u.email || "").toLowerCase().includes(mentionQuery.toLowerCase()))
    : mentionUsers;

  useEffect(() => {
    if (!mentionOpen) return;
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mentionOpen]);

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const handleContentChange = (value: string) => {
    setContent(value);
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex >= 0 && (lastAtIndex === 0 || value[lastAtIndex - 1] === " ")) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        setMentionQuery(afterAt);
        setMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  const selectMention = (u: MentionUser) => {
    const lastAtIndex = content.lastIndexOf("@");
    const before = content.slice(0, lastAtIndex);
    const name = u.name || u.email?.split("@")[0] || u.id;
    setContent(before + "@" + name + " ");
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!content.trim() && files.length === 0) return;
    try {
      await onSend(content.trim(), files);
      setContent("");
      setFiles([]);
      inputRef.current?.focus();
    } catch { /* keep content */ }
  };

  return (
    <div className="relative shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
      {mentionOpen && filteredMentions.length > 0 && (
        <div ref={mentionRef}
          className="absolute bottom-full left-5 right-5 z-10 mb-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filteredMentions.slice(0, 8).map((u, i) => (
            <button key={u.id}
              onClick={() => selectMention(u)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                i === mentionIndex ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-[8px] font-bold text-white">
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              {u.name || u.email}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          {banner}
          <textarea ref={inputRef} value={content} onChange={(e) => handleContentChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !mentionOpen) { e.preventDefault(); handleSend(); }
              if (e.key === "ArrowDown" && mentionOpen) { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1)); }
              if (e.key === "ArrowUp" && mentionOpen) { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && mentionOpen) { e.preventDefault(); if (filteredMentions[mentionIndex]) selectMention(filteredMentions[mentionIndex]); }
              if (e.key === "Escape") setMentionOpen(false);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none resize-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500" />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <FilePreview key={f.name} file={f} onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-300 p-2.5 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-colors dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:text-indigo-300">
            <Paperclip className="h-4 w-4" />
          </button>
          <button onClick={handleSend} disabled={(!content.trim() && files.length === 0) || sending}
            className="rounded-lg bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          setFiles((prev) => [...prev, ...selected]);
          e.target.value = "";
        }}
        className="hidden" />
    </div>
  );
}

interface ChatFilterable {
  content?: string;
  user_id: string;
  created: string;
}

export function filterMessages<T extends ChatFilterable>(
  messages: T[],
  search: string,
  personFilters: string[],
  dateFrom: string,
  dateTo: string
): T[] {
  let list = messages;
  const q = search.trim().toLowerCase();
  if (q) list = list.filter((m) => (m.content || "").toLowerCase().includes(q));
  if (personFilters.length) list = list.filter((m) => personFilters.includes(m.user_id));
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (!isNaN(from.getTime())) list = list.filter((m) => new Date(m.created) >= from);
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`);
    if (!isNaN(to.getTime())) list = list.filter((m) => new Date(m.created) <= to);
  }
  return list;
}

export function chatSenders<T extends ChatFilterable>(
  messages: T[],
  users?: { id: string; name?: string; email?: string }[]
): { id: string; label: string }[] {
  const lastSeen = new Map<string, number>();
  messages.forEach((m) => {
    if (m.user_id) lastSeen.set(m.user_id, new Date(m.created).getTime());
  });
  const userById = new Map((users || []).map((u) => [u.id, u]));
  return Array.from(lastSeen.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => {
      const u = userById.get(id);
      return { id, label: u?.name || u?.email || id };
    });
}

interface ChatFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  personFilters: string[];
  onPersonToggle: (id: string) => void;
  personOptions: { id: string; label: string }[];
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  onClear: () => void;
  accentColor?: "indigo" | "purple";
}

export function ChatFilters({
  search, onSearchChange, personFilters, onPersonToggle, personOptions,
  dateFrom, onDateFromChange, dateTo, onDateToChange, onClear, accentColor = "indigo",
}: ChatFiltersProps) {
  const [open, setOpen] = useState(false);
  const hasActive = !!(search || personFilters.length > 0 || dateFrom || dateTo);
  const active = accentColor === "purple"
    ? "border-purple-300 bg-purple-100 text-purple-600 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
    : "border-indigo-300 bg-indigo-100 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
  const dot = accentColor === "purple" ? "bg-purple-500" : "bg-indigo-500";
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} title="Bộ lọc tin nhắn"
        className={`absolute right-4 top-2 z-30 rounded-lg border p-1.5 shadow-sm transition-colors ${hasActive ? active : "border-slate-200 bg-white/90 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
        <Filter className="h-4 w-4" />
        {hasActive && (
          <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${dot} dark:border-slate-900`} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-4 top-10 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input value={search} onChange={(e) => onSearchChange(e.target.value)} aria-label="Tìm tin nhắn"
                placeholder="Tìm nội dung tin nhắn..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500" />
            </div>
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
              <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)}
                className="w-[105px] border-none bg-transparent p-0 text-xs text-slate-700 focus:outline-none dark:text-slate-200" title="Từ ngày" />
              <span className="text-slate-300 dark:text-slate-600">—</span>
              <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)}
                className="w-[105px] border-none bg-transparent p-0 text-xs text-slate-700 focus:outline-none dark:text-slate-200" title="Đến ngày" />
            </div>
            <div className="mt-2">
              <CheckCombobox
                items={personOptions}
                selected={personFilters}
                onToggle={onPersonToggle}
                label="Người gửi"
                placeholder="Tất cả mọi người"
                accentColor={accentColor}
                size="sm"
              />
            </div>
            {hasActive && (
              <button onClick={() => { onClear(); setOpen(false); }}
                className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
                Xóa lọc
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
