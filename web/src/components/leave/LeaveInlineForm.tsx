import { useState } from "react";
import { X, Check, Loader2, Clock } from "lucide-react";
import type { LeaveType, LeavePeriod } from "@shared/types";
import { LEAVE_TYPE_LABELS, PERIOD_LABELS } from "../../utils/constants";
import { errorMessage } from "../../utils/errors";

const PERIOD_OPTIONS: { value: LeavePeriod; label: string }[] = (Object.keys(PERIOD_LABELS) as LeavePeriod[]).map((value) => ({
  value,
  label: PERIOD_LABELS[value],
}));

interface Props {
  initialValues?: {
    leave_type?: LeaveType;
    start_date?: string;
    end_date?: string;
    reason?: string;
    period?: LeavePeriod;
  };
  onSubmit: (data: {
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    period: LeavePeriod;
  }) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  title?: string;
  tableMode?: boolean;
  requesterName?: string;
}

export default function LeaveInlineForm({ initialValues, onSubmit, onCancel, pending, title, tableMode, requesterName }: Props) {
  const [leaveType, setLeaveType] = useState<LeaveType>(initialValues?.leave_type || "annual");
  const [startDate, setStartDate] = useState(initialValues?.start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialValues?.end_date?.slice(0, 10) || "");
  const [period, setPeriod] = useState<LeavePeriod>(initialValues?.period || "full");
  const [reason, setReason] = useState(initialValues?.reason || "");
  const [error, setError] = useState("");

  const isHalfDay = period !== "full";

  const handleSubmit = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const start = startDate;
    const end = isHalfDay ? start : endDate;
    if (!start || (!isHalfDay && !end) || !reason.trim()) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (!isHalfDay && new Date(end) < new Date(start)) {
      setError("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    setError("");
    const total_days = isHalfDay
      ? 0.5
      : Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    try {
      await onSubmit({
        leave_type: leaveType,
        start_date: new Date(start).toISOString(),
        end_date: new Date(end).toISOString(),
        total_days,
        reason: reason.trim(),
        period,
      });
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  };

  const handleStartChange = (v: string) => {
    setStartDate(v);
    if (isHalfDay) setEndDate(v);
  };

  const handlePeriodChange = (v: LeavePeriod) => {
    setPeriod(v);
    if (v !== "full") setEndDate(startDate);
  };

  if (tableMode) {
    return (
      <>
        <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">{requesterName}</td>
        <td className="px-6 py-3">
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500">
            {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
              <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </td>
        <td className="px-6 py-3">
          <div className="flex gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => handlePeriodChange(o.value)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  period === o.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isHalfDay}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500" />
          </div>
        </td>
        <td className="px-6 py-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do xin nghỉ *" rows={2}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 resize-none" />
        </td>
        <td className="px-6 py-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <Clock className="h-3 w-3" /> Chờ duyệt
          </span>
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
            <button type="button" onClick={() => handleSubmit()} disabled={pending}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Lưu thay đổi
            </button>
          </div>
          {error && <div className="mt-1.5 rounded bg-red-50 p-1.5 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">{error}</div>}
        </td>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-300 bg-indigo-50/40 p-3 space-y-2.5 dark:border-indigo-800 dark:bg-indigo-950/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{title || "Thêm đơn xin nghỉ phép"}</span>
        <button type="button" onClick={onCancel} aria-label="Đóng" title="Đóng"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">{error}</div>}
      <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500">
        {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
          <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <div className="flex gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
        {PERIOD_OPTIONS.map((o) => (
          <button key={o.value} type="button" onClick={() => handlePeriodChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              period === o.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isHalfDay}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500" />
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do xin nghỉ *" rows={2}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 resize-none" />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
        <button type="submit" disabled={pending}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {title ? "Lưu thay đổi" : "Gửi đơn xin nghỉ"}
        </button>
      </div>
    </form>
  );
}
