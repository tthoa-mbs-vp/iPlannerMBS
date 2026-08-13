import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Building2, Briefcase, Calendar, FileText } from "lucide-react";
import { useWorkExperiences, useCreateWorkExperience, useUpdateWorkExperience, useDeleteWorkExperience } from "../../hooks/useWorkExperiences";
import { formatDate } from "../../utils/format";
import type { WorkExperience } from "@shared/types";
import Spinner from "../shared/Spinner";

function toInputDate(d: string) {
  if (!d) return "";
  return d.slice(0, 10);
}

export default function WorkHistoryTab({ userId, canEdit = true }: { userId: string; canEdit?: boolean }) {
  const { data: items = [], isLoading } = useWorkExperiences(userId);
  const create = useCreateWorkExperience();
  const update = useUpdateWorkExperience();
  const del = useDeleteWorkExperience();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [organization, setOrganization] = useState("");
  const [position, setPosition] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setOrganization("");
    setPosition("");
    setStartDate("");
    setEndDate("");
    setDescription("");
  };

  const startEdit = (r: WorkExperience) => {
    setEditingId(r.id);
    setIsAdding(false);
    setOrganization(r.organization);
    setPosition(r.position);
    setStartDate(toInputDate(r.start_date));
    setEndDate(toInputDate(r.end_date || ""));
    setDescription(r.description || "");
  };

  const handleSave = async () => {
    if (!organization.trim() || !position.trim() || !startDate) return;
    const payload: Partial<WorkExperience> = {
      user_id: userId,
      organization: organization.trim(),
      position: position.trim(),
      start_date: startDate,
      end_date: endDate || undefined,
      description: description.trim() || undefined,
    };
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xóa quá trình công tác này?")) await del.mutateAsync(id);
  };

  if (isLoading) return <Spinner size="sm" color="border-blue-500" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{items.length} quá trình công tác</span>
        {canEdit && !isAdding && !editingId && (
          <button onClick={() => { resetForm(); setIsAdding(true); }}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800 dark:bg-blue-950/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Cơ quan / Đơn vị <span className="text-red-500">*</span></label>
              <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="VD: Công ty MBS"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Chức vụ / Vị trí <span className="text-red-500">*</span></label>
              <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="VD: Trưởng phòng CNTT"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Mô tả</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhiệm vụ chính (không bắt buộc)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Ngày bắt đầu <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Ngày kết thúc</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
            <button onClick={handleSave} disabled={create.isPending || update.isPending || !organization.trim() || !position.trim() || !startDate}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Lưu
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center py-8 text-slate-400 dark:text-slate-500">
          <Briefcase className="mb-2 h-8 w-8" />
          <p className="text-sm">Chưa có quá trình công tác</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 hover:border-blue-200 dark:hover:border-blue-800 transition">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500 shrink-0 dark:text-blue-400" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.organization}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 ml-6 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{r.position}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(r.start_date)} → {r.end_date ? formatDate(r.end_date) : "Hiện tại"}</span>
                  {r.description && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{r.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 hover:text-blue-600 transition dark:hover:bg-slate-800 dark:hover:text-blue-300" title="Sửa"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 hover:text-red-600 transition dark:hover:bg-slate-800 dark:hover:text-red-300" title="Xóa"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
