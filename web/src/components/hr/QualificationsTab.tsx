import { useState } from "react";
import { Plus, Pencil, Trash2, Check, GraduationCap, Building2, Calendar, BookOpen, Award } from "lucide-react";
import { useQualifications, useCreateQualification, useUpdateQualification, useDeleteQualification } from "../../hooks/useQualifications";
import type { Qualification } from "@shared/types";
import Spinner from "../shared/Spinner";

const TRAINING_TYPES = ["Chính quy", "Tại chức", "Từ xa", "Liên thông", "Bồi dưỡng", "Khác"];
const CERTIFICATE_TYPES = ["Bằng đại học", "Bằng cao đẳng", "Bằng thạc sĩ", "Bằng tiến sĩ", "Chứng chỉ", "Chứng nhận", "Khác"];

export default function QualificationsTab({ userId, canEdit = true }: { userId: string; canEdit?: boolean }) {
  const { data: items = [], isLoading } = useQualifications(userId);
  const create = useCreateQualification();
  const update = useUpdateQualification();
  const del = useDeleteQualification();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [trainingPlace, setTrainingPlace] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [certificateType, setCertificateType] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setName("");
    setTrainingPlace("");
    setStartDate("");
    setEndDate("");
    setTrainingType("");
    setCertificateType("");
  };

  const startEdit = (q: Qualification) => {
    setEditingId(q.id);
    setIsAdding(false);
    setName(q.name);
    setTrainingPlace(q.training_place);
    setStartDate(q.start_date?.slice(0, 7) || "");
    setEndDate(q.end_date?.slice(0, 7) || "");
    setTrainingType(q.training_type);
    setCertificateType(q.certificate_type);
  };

  const handleSave = async () => {
    if (!name.trim() || !trainingPlace.trim()) return;
    const payload: Partial<Qualification> = {
      user_id: userId,
      name: name.trim(),
      training_place: trainingPlace.trim(),
      start_date: startDate ? `${startDate}-01` : "",
      end_date: endDate ? `${endDate}-01` : "",
      training_type: trainingType,
      certificate_type: certificateType,
    };
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = async (id: string, n: string) => {
    if (confirm(`Xóa "${n}"?`)) await del.mutateAsync(id);
  };

  if (isLoading) return <Spinner size="sm" color="border-indigo-500" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{items.length} bằng cấp / chứng chỉ</span>
        {canEdit && !isAdding && !editingId && (
          <button onClick={() => { resetForm(); setIsAdding(true); }}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800 dark:bg-indigo-950/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Tên bằng cấp / chứng chỉ <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Cử nhân Quản trị kinh doanh"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Nơi đào tạo <span className="text-red-500">*</span></label>
              <input type="text" value={trainingPlace} onChange={(e) => setTrainingPlace(e.target.value)} placeholder="VD: Đại học Kinh tế Quốc dân"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Thời gian bắt đầu</label>
              <input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Thời gian kết thúc</label>
              <input type="month" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Loại hình đào tạo</label>
              <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none">
                <option value="">— Chọn —</option>
                {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Loại bằng cấp</label>
              <select value={certificateType} onChange={(e) => setCertificateType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none">
                <option value="">— Chọn —</option>
                {CERTIFICATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
            <button onClick={handleSave} disabled={create.isPending || update.isPending}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
              <Check className="h-3.5 w-3.5" /> Lưu
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center py-8 text-slate-400 dark:text-slate-500">
          <GraduationCap className="mb-2 h-8 w-8" />
          <p className="text-sm">Chưa có bằng cấp / chứng chỉ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-indigo-500 shrink-0 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{q.name}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 ml-6 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{q.training_place}</span>
                  {q.start_date && (
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{q.start_date.slice(0, 7)} → {q.end_date?.slice(0, 7) || "nay"}</span>
                  )}
                  {q.training_type && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{q.training_type}</span>}
                  {q.certificate_type && <span className="flex items-center gap-1"><Award className="h-3 w-3" />{q.certificate_type}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 hover:text-indigo-600 transition dark:hover:bg-slate-800 dark:hover:text-indigo-300" title="Sửa"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(q.id, q.name)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 hover:text-red-600 transition dark:hover:bg-slate-800 dark:hover:text-red-300" title="Xóa"><Trash2 className="h-3.5 w-3.5" /></button>
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
