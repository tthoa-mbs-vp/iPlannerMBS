import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { timeAgo } from "../../utils/format";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  decodeRef,
  getNotificationTypeLabel,
  getNotificationLink,
} from "../../hooks/useNotifications";
import {
  Bell,
  AtSign,
  MessageSquare,
  Clock,
  GitPullRequest,
  AlertTriangle,
  Megaphone,
  CheckCheck,
  BellRing,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "announcement", label: "Thông báo" },
  { value: "mention", label: "Đề cập" },
  { value: "reply", label: "Trả lời" },
  { value: "deadline_warning", label: "Hạn chót" },
  { value: "task_update", label: "Cập nhật" },
  { value: "proposal_update", label: "Đề xuất" },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  announcement: Megaphone,
  mention: AtSign,
  reply: MessageSquare,
  deadline_warning: Clock,
  task_update: GitPullRequest,
  proposal_update: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  announcement: "bg-rose-100 text-rose-600",
  mention: "bg-indigo-100 text-indigo-600",
  reply: "bg-blue-100 text-blue-600",
  deadline_warning: "bg-amber-100 text-amber-600",
  task_update: "bg-emerald-100 text-emerald-600",
  proposal_update: "bg-purple-100 text-purple-600",
};

const PER_PAGE = 20;

function formatTime(iso: string): string {
  return timeAgo(iso);
}

export default function MNotificationsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("");
  const [limit, setLimit] = useState(PER_PAGE);
  const { data, isLoading } = useNotifications(1, limit, typeFilter || undefined);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const items = data?.items || [];
  const total = data?.totalItems || 0;

  const handleOpen = (n: (typeof items)[number]) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    const link = getNotificationLink(n);
    if (link && link !== "#") {
      if (link.startsWith("/announcements/")) {
        navigate(`/m/announcements/${link.split("/").pop()}`);
      } else if (link.startsWith("/tasks/")) {
        navigate("/m/tasks");
      } else {
        navigate(link);
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white">
              <Bell className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Thông báo</h2>
          </div>
          {total > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đã đọc tất cả
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTypeFilter(t.value);
                setLimit(PER_PAGE);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 p-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <BellRing className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            Không có thông báo
          </div>
        ) : (
          items.map((n) => {
            const ref = decodeRef(n);
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                  !n.is_read
                    ? "border-indigo-100 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/40"
                    : "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    TYPE_COLORS[n.type] || "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {ref.message || getNotificationTypeLabel(n.type)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{formatTime(n.created)}</p>
                </div>
                {!n.is_read && (
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                )}
              </button>
            );
          })
        )}
        {items.length < total && (
          <button
            onClick={() => setLimit((l) => l + PER_PAGE)}
            className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
          >
            Tải thêm ({total - items.length} còn lại)
          </button>
        )}
      </div>
    </div>
  );
}
