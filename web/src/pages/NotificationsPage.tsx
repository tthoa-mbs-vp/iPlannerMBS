import { useEffect, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { Link } from "react-router-dom";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, decodeRef, getNotificationTypeLabel, getNotificationLink } from "../hooks/useNotifications";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  Bell, AtSign, MessageSquare, Clock, GitPullRequest, AlertTriangle, Megaphone,
  CheckCheck, ChevronLeft, ChevronRight, BellRing,
} from "lucide-react";
import TabBar from "../components/shared/TabBar";
import Spinner from "../components/shared/Spinner";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import { timeAgo } from "../utils/format";

const TYPE_OPTIONS: { value: string; label: string; gradient?: string }[] = [
  { value: "", label: "Tất cả", gradient: "from-indigo-500 to-purple-600" },
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

const PER_PAGE = 15;

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = usePersistedState("notif_typeFilter", "");
  const { data, isLoading, error: notifError, refetch: refetchNotifs } = useNotifications(page, PER_PAGE, typeFilter || undefined);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const totalPages = data ? Math.ceil(data.totalItems / PER_PAGE) : 0;

  useEffect(() => { usePageTitleStore.getState().setTitle("Thông báo"); }, []);

  return (
    <div className="flex h-full flex-col gap-5">

      {/* Filter + actions row */}
      <div className="flex items-center justify-between">
        <TabBar
          tabs={TYPE_OPTIONS.map((o) => ({ key: o.value, label: o.label, gradient: o.gradient }))}
          active={typeFilter}
          onChange={(k) => { setTypeFilter(k); setPage(1); }}
          size="sm"
        />
        <button onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition-colors dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
          <CheckCheck className="h-3.5 w-3.5" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <Spinner size="md" />
      ) : notifError ? (
        <ErrorState message="Không thể tải thông báo" subMessage="Vui lòng thử lại sau" onRetry={() => refetchNotifs()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={BellRing} message="Không có thông báo" size="lg" />
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {data.items.map((n) => {
            const ref = decodeRef(n);
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <Link key={n.id} to={getNotificationLink(n)}
                onClick={() => { if (!n.is_read) markAsRead.mutate(n.id); }}
                className={`flex items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${
                  !n.is_read ? "border-indigo-100 bg-indigo-50/30 dark:border-indigo-800/60 dark:bg-indigo-900/30" : "border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                }`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  n.type === "announcement" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300" :
                  n.type === "mention" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" :
                  n.type === "reply" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" :
                  n.type === "deadline_warning" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" :
                  n.type === "task_update" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" :
                  n.type === "proposal_update" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300" :
                  "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{ref.message || getNotificationTypeLabel(n.type)}</p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{timeAgo(n.created)}</p>
                </div>
                {!n.is_read && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                )}
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead.mutate(n.id); }}
                  className="shrink-0 rounded p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors dark:text-slate-600 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/40"
                  title="Đánh dấu đã đọc">
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <ChevronLeft className="h-3.5 w-3.5" /> Trước
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Trang {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Sau <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
