import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Loader2, MessageSquare, GitPullRequest, Clock, AlertTriangle, AtSign, Megaphone, ChevronDown, ChevronRight, Eye, ShieldCheck } from "lucide-react";
import { formatDateTimeShort } from "../../utils/format";
import {
  useUnreadCount,
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  decodeRef,
  getNotificationTypeLabel,
  getNotificationLink,
} from "../../hooks/useNotifications";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import type { Notification } from "@shared/types";

const TYPE_ICONS: Record<string, typeof Bell> = {
  announcement: Megaphone,
  mention: AtSign,
  reply: MessageSquare,
  deadline_warning: Clock,
  task_update: GitPullRequest,
  proposal_update: AlertTriangle,
  surprise_check: ShieldCheck,
};

const TYPE_COLORS: Record<string, string> = {
  announcement: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
  mention: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  reply: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  deadline_warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  task_update: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  proposal_update: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  surprise_check: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

interface Group {
  taskId: string;
  taskName: string;
  items: Notification[];
}

function groupByTask(items: Notification[]): Group[] {
  const groups: Record<string, Group> = {};
  const ungrouped: Notification[] = [];

  for (const n of items) {
    const ref = decodeRef(n);
    if (ref.announcementId) {
      const key = `ann-${ref.announcementId}`;
      if (!groups[key]) {
        groups[key] = { taskId: `ann-${ref.announcementId}`, taskName: ref.title || "Thông báo", items: [] };
      }
      groups[key].items.push(n);
    } else if (ref.taskId) {
      if (!groups[ref.taskId]) {
        groups[ref.taskId] = { taskId: ref.taskId, taskName: ref.taskName || "", items: [] };
      }
      groups[ref.taskId].items.push(n);
    } else {
      ungrouped.push(n);
    }
  }

  const result = Object.values(groups);
  // sort groups by most recent notification
  result.sort((a, b) => {
    const aLast = a.items.reduce((max, n) => Math.max(max, new Date(n.created).getTime()), 0);
    const bLast = b.items.reduce((max, n) => Math.max(max, new Date(n.created).getTime()), 0);
    return bLast - aLast;
  });

  if (ungrouped.length > 0) {
    result.push({ taskId: "", taskName: "Khác", items: ungrouped });
  }
  return result;
}

function NotifItem({ n, onRead, onClose }: { n: Notification; onRead: (id: string) => void; onClose: () => void }) {
  const ref = decodeRef(n);
  const Icon = TYPE_ICONS[n.type] || Bell;
  return (
    <Link
      key={n.id}
      to={getNotificationLink(n)}
      onClick={() => {
        if (!n.is_read) onRead(n.id);
        onClose();
      }}
      className={`flex items-start gap-3 border-b border-white/10 px-4 py-2.5 pl-10 text-sm backdrop-blur-md transition-all duration-200 hover:bg-white/50 dark:hover:bg-white/10 ${
        !n.is_read ? "bg-indigo-50/20 dark:bg-indigo-900/20" : "bg-white/5"
      }`}
    >
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TYPE_COLORS[n.type] || "bg-slate-100/80 text-slate-500 dark:bg-slate-800 dark:text-slate-400"} backdrop-blur-sm`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed text-slate-600 text-xs dark:text-slate-200">
          {ref.message || getNotificationTypeLabel(n.type)}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
          {formatDateTimeShort(n.created)}
        </p>
      </div>
      {!n.is_read && (
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
      )}
    </Link>
  );
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifData, isLoading } = useNotifications(1, 50, undefined, open);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = useMemo(() => notifData?.items || [], [notifData]);
  const groups = useMemo(() => groupByTask(notifications), [notifications]);

  const toggleGroup = (taskId: string) => {
    setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)} aria-label="Thông báo"
        className="relative rounded-full p-2 text-slate-500 transition-all duration-200 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:from-indigo-950/40 dark:hover:to-blue-950/40"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-96 overflow-hidden rounded-2xl border border-white/30 bg-white/60 backdrop-blur-2xl shadow-2xl shadow-indigo-500/15 dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-white/20 px-4 py-3 backdrop-blur-sm">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Thông báo</h4>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-40 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                <CheckCheck className="h-3 w-3" />
                Đã đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-indigo-200 [&::-webkit-scrollbar-track]:bg-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                Không có thông báo
              </div>
            ) : (
              groups.map((group) => {
                const isExpanded = expanded[group.taskId] !== false; // default expanded
                const groupUnread = group.items.filter((n) => !n.is_read).length;
                return (
                  <div key={group.taskId || "__ungrouped"}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.taskId)}
                      className="flex w-full items-center gap-2 border-b border-white/10 bg-white/20 px-4 py-2 text-left text-xs font-semibold text-slate-500 backdrop-blur-sm hover:bg-white/30 transition-colors dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="truncate flex-1" title={group.taskName || "Không có tên"}>{group.taskName || "Không có tên"}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{group.items.length}</span>
                      {groupUnread > 0 && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                      )}
                    </button>
                    {/* Group items */}
                    {isExpanded && group.items.map((n) => (
                      <NotifItem
                        key={n.id}
                        n={n}
                        onRead={(id) => markAsRead.mutate(id)}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-white/20 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 backdrop-blur-sm transition-colors dark:text-indigo-300 dark:hover:bg-indigo-900/30">
            <Eye className="h-3.5 w-3.5" />
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
