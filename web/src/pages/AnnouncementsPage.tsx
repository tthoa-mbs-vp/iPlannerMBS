import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from "../hooks/useAnnouncements";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  Megaphone, Pin, Plus, Pencil, Trash2, ChevronLeft, User as UserIcon, EyeOff, CheckSquare,
} from "lucide-react";
import Spinner from "../components/shared/Spinner";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import { errorMessage } from "../utils/errors";
import Modal from "../components/shared/Modal";
import { sanitizeHtml, stripTags } from "../utils/sanitize";
import type { Announcement } from "@shared/types";

const emptyForm = { title: "", content: "", is_pinned: false, is_active: true };

export default function AnnouncementsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: announcements, isLoading, error, refetch } = useAnnouncements();

  const user = useAuthStore((s) => s.user);
  const canManage = !!user?.expand?.role_id?.can_manage;
  const createAnnouncement = useCreateAnnouncement(user?.id);
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedId = id || null;

  useEffect(() => { usePageTitleStore.getState().setTitle("Bảng tin"); }, []);

  const visible = useMemo(() => {
    if (!announcements) return [];
    return canManage ? announcements : announcements.filter((a) => a.is_active);
  }, [announcements, canManage]);

  const selected = visible.find((a) => a.id === selectedId) || null;

  const openForm = (a?: Announcement) => {
    setEditing(a || null);
    setForm(a ? { title: a.title, content: a.content, is_pinned: a.is_pinned, is_active: a.is_active } : emptyForm);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      content: form.content,
      is_pinned: form.is_pinned,
      is_active: form.is_active,
    };
    if (editing) await updateAnnouncement.mutateAsync({ id: editing.id, ...payload });
    else await createAnnouncement.mutateAsync({ ...payload, published_at: new Date().toISOString() });
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`Xóa thông báo "${a.title}"?`)) return;
    await deleteAnnouncement.mutateAsync(a.id);
    if (selectedId === a.id) navigate("/announcements");
  };

  if (isLoading) return <Spinner size="md" />;
  if (error) return <ErrorState message="Không thể tải bảng tin" subMessage={errorMessage(error, "Vui lòng thử lại")} onRetry={() => refetch()} />;

  return (
    <div className="flex h-full gap-5">
      {/* List */}
      <div className="w-80 shrink-0 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-500 to-orange-500 text-white shadow-sm">
              <Megaphone className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bảng tin</h2>
          </div>
          {canManage && (
            <button onClick={() => openForm()} aria-label="Đăng thông báo mới"
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40">
              <Plus className="h-3.5 w-3.5" /> Đăng
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <div className="py-10">
            <EmptyState icon={Megaphone} message="Chưa có thông báo nào" size="md" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {visible.map((a) => (
              <button key={a.id} onClick={() => navigate(`/announcements/${a.id}`)}
                className={`block w-full px-4 py-3 text-left transition-colors ${selectedId === a.id ? "bg-indigo-50/70 dark:bg-indigo-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <div className="flex items-center gap-2">
                  {a.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" />}
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</span>
                  {!a.is_active && (
                    <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <EyeOff className="h-3 w-3" /> Ẩn
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{stripTags(a.content) || "—"}</p>
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  {a.expand?.author_id?.name || "Admin"} · {new Date(a.published_at || a.created).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Megaphone className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Chọn một thông báo để xem chi tiết</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { if (id) navigate("/announcements"); }} aria-label="Quay lại"
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    {selected.is_pinned && (
                      <span className="flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                        <Pin className="h-3 w-3" /> Ghim
                      </span>
                    )}
                    {!selected.is_active && (
                      <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <EyeOff className="h-3 w-3" /> Không hiển thị
                      </span>
                    )}
                  </div>
                  <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{selected.title}</h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                    <UserIcon className="h-3.5 w-3.5" />
                    {selected.expand?.author_id?.name || "Admin"} · {new Date(selected.published_at || selected.created).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => openForm(selected)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <Pencil className="h-3.5 w-3.5" /> Sửa
                  </button>
                  <button onClick={() => handleDelete(selected)}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40">
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </button>
                </div>
              )}
            </div>
            <div className="prose prose-sm prose-slate max-w-none border-t border-slate-100 pt-5 dark:border-slate-700 dark:prose-invert [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content) }} />
          </>
        )}
      </div>

      {/* Create/Edit form modal */}
      {formOpen && (
        <Modal title={editing ? "Chỉnh sửa thông báo" : "Đăng thông báo mới"} onClose={() => setFormOpen(false)} maxWidth="2xl">
          <div className="p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tiêu đề *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Nhập tiêu đề thông báo" maxLength={200}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-indigo-900/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nội dung</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Nhập nội dung thông báo… (hỗ trợ HTML cơ bản)" rows={8}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-indigo-900/40" />
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Có thể sử dụng thẻ HTML như &lt;strong&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;p&gt;.</p>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 dark:border-slate-600" />
                  <Pin className="h-3.5 w-3.5 text-rose-500" /> Ghim lên đầu
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600" />
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-500" /> Hiển thị cho mọi người
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                Hủy
              </button>
              <button onClick={handleSave} disabled={!form.title.trim() || createAnnouncement.isPending || updateAnnouncement.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {editing ? "Lưu thay đổi" : "Đăng thông báo"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
