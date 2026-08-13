import { useState } from "react";
import { Plus, Pencil, Trash2, Check, DollarSign, Calendar, FileText, Hash } from "lucide-react";
import { useSalaryRecords, useCreateSalaryRecord, useUpdateSalaryRecord, useDeleteSalaryRecord } from "../../hooks/useSalaryRecords";
import { formatDate } from "../../utils/format";
import type { SalaryRecord } from "@shared/types";
import Spinner from "../shared/Spinner";

function toInputDate(d: string) {
  if (!d) return "";
  return d.slice(0, 10);
}

export default function SalaryHistoryTab({ userId, canEdit = true }: { userId: string; canEdit?: boolean }) {
  const { data: items = [], isLoading } = useSalaryRecords(userId);
  const create = useCreateSalaryRecord();
  const update = useUpdateSalaryRecord();
  const del = useDeleteSalaryRecord();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [salaryCoefficient, setSalaryCoefficient] = useState("");
  const [allowanceCoefficient, setAllowanceCoefficient] = useState("");
  const [decisionNumber, setDecisionNumber] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setStartDate("");
    setSalaryCoefficient("");
    setAllowanceCoefficient("");
    setDecisionNumber("");
  };

  const startEdit = (r: SalaryRecord) => {
    setEditingId(r.id);
    setIsAdding(false);
    setStartDate(toInputDate(r.start_date));
    setSalaryCoefficient(String(r.salary_coefficient));
    setAllowanceCoefficient(String(r.allowance_coefficient));
    setDecisionNumber(r.decision_number);
  };

  const handleSave = async () => {
    if (!startDate || !salaryCoefficient) return;
    const payload: Partial<SalaryRecord> = {
      user_id: userId,
      start_date: startDate,
      salary_coefficient: parseFloat(salaryCoefficient) || 0,
      allowance_coefficient: parseFloat(allowanceCoefficient) || 0,
      decision_number: decisionNumber.trim(),
    };
    if (editingId) {
      await update.mutateAsync({ id: editingId, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xóa quá trình lương này?")) await del.mutateAsync(id);
  };

  if (isLoading) return <Spinner size="sm" color="border-emerald-500" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{items.length} quá trình lương</span>
        {canEdit && !isAdding && !editingId && (
          <button onClick={() => { resetForm(); setIsAdding(true); }}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-950/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Ngày bắt đầu <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Số quyết định</label>
              <input type="text" value={decisionNumber} onChange={(e) => setDecisionNumber(e.target.value)} placeholder="VD: 123/QĐ-NS"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Hệ số lương <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0" value={salaryCoefficient} onChange={(e) => setSalaryCoefficient(e.target.value)} placeholder="VD: 2.34"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-300">Hệ số phụ cấp</label>
              <input type="number" step="0.01" min="0" value={allowanceCoefficient} onChange={(e) => setAllowanceCoefficient(e.target.value)} placeholder="VD: 0.5"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
            <button onClick={handleSave} disabled={create.isPending || update.isPending}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition">
              <Check className="h-3.5 w-3.5" /> Lưu
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center py-8 text-slate-400 dark:text-slate-500">
          <DollarSign className="mb-2 h-8 w-8" />
          <p className="text-sm">Chưa có quá trình lương</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 hover:border-emerald-200 dark:hover:border-emerald-800 transition">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500 shrink-0 dark:text-emerald-400" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Hệ số {r.salary_coefficient}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 ml-6 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(r.start_date)}</span>
                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" />Phụ cấp: {r.allowance_coefficient}</span>
                  {r.decision_number && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />QĐ: {r.decision_number}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800 hover:text-emerald-600 transition dark:hover:bg-slate-800 dark:hover:text-emerald-300" title="Sửa"><Pencil className="h-3.5 w-3.5" /></button>
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
