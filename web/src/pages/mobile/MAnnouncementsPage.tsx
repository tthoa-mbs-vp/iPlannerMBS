import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useAnnouncements,
  useDeleteAnnouncement,
} from "../../hooks/useAnnouncements";
import { useAuthStore } from "../../stores/authStore";
import { sanitizeHtml, stripTags } from "../../utils/sanitize";
import {
  Megaphone,
  Pin,
  ChevronLeft,
  User as UserIcon,
  EyeOff,
  Trash2,
} from "lucide-react";
import type { Announcement } from "@shared/types";

export default function MAnnouncementsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: announcements, isLoading } = useAnnouncements();
  const user = useAuthStore((s) => s.user);
  const canManage = !!user?.expand?.role_id?.can_manage;

  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const deleteAnnouncement = useDeleteAnnouncement();

  const visible = useMemo(() => {
    if (!announcements) return [];
    return canManage ? announcements : announcements.filter((a) => a.is_active);
  }, [announcements, canManage]);

  const selected = visible.find((a) => a.id === id) || null;

  if (selected) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => navigate("/m/announcements")}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Quay lại"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 truncate text-base font-bold text-slate-800 dark:text-slate-100">Bảng tin</h1>
          {canManage && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmDelete(selected)}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-900/40 dark:hover:text-rose-400"
                aria-label="Xóa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {selected.is_pinned && (
                <span className="flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                  <Pin className="h-3 w-3" /> Ghim
                </span>
              )}
              {!selected.is_active && (
                <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  <EyeOff className="h-3 w-3" /> Ẩn
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selected.title}</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <UserIcon className="h-3.5 w-3.5" />
              {selected.expand?.author_id?.name || "Admin"} ·{" "}
              {new Date(selected.published_at || selected.created).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "numeric",
                month: "numeric",
                year: "numeric",
              })}
            </p>
            <div
              className="prose prose-sm prose-slate mt-4 max-w-none border-t border-slate-100 pt-4 dark:border-slate-700 dark:prose-invert [&_img]:max-w-full [&_img]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content) }}
            />
          </div>
        </div>

        {confirmDelete && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Xóa thông báo</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Bạn chắc chắn muốn xóa "{confirmDelete.title}"?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    deleteAnnouncement.mutateAsync(confirmDelete.id);
                    setConfirmDelete(null);
                    navigate("/m/announcements");
                  }}
                  disabled={deleteAnnouncement.isPending}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-500 to-orange-500 text-white">
            <Megaphone className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Bảng tin</h2>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải...</div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <Megaphone className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            Chưa có thông báo nào
          </div>
        ) : (
          visible.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/m/announcements/${a.id}`)}
              className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start gap-2">
                {a.is_pinned && (
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                    <Pin className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {stripTags(a.content) || "—"}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    {a.expand?.author_id?.name || "Admin"} ·{" "}
                    {new Date(a.published_at || a.created).toLocaleDateString("vi-VN", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
