import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import CollaboratorSelect from "../shared/CollaboratorSelect";
import { errorMessage } from "../../utils/errors";
import type { TaskCategory } from "@shared/types";

interface UserBrief {
  id: string;
  name?: string;
  email?: string;
  expand?: { role_id?: { level?: string } };
}

interface PlanBrief {
  id: string;
  name: string;
}

interface Props {
  initialValues?: {
    name?: string;
    description?: string;
    category?: TaskCategory;
    executor_id?: string;
    supervisor_id?: string;
    collaborator_ids?: string[];
    start_date?: string;
    deadline?: string;
    is_recurring?: boolean;
    is_ad_hoc?: boolean;
    is_high_impact?: boolean;
  };
  onSubmit: (data: {
    name: string;
    description?: string;
    category: TaskCategory;
    executor_id: string;
    supervisor_id?: string;
    collaborator_ids: string[];
    start_date: string;
    deadline: string;
    is_recurring?: boolean;
    plan_id?: string;
    is_ad_hoc: boolean;
    is_high_impact: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  eligibleUsers: UserBrief[];
  accentColor?: string;
  size?: "sm" | "md";
  showRecurring?: boolean;
  title?: string;
  planId?: string;
  planName?: string;
  plans?: PlanBrief[];
}

const SIZE: Record<"sm" | "md", { field: string; heading: string }> = {
  sm: { field: "px-2.5 py-1.5 text-xs", heading: "text-xs" },
  md: { field: "px-3 py-2 text-sm", heading: "text-sm" },
};

const ACCENT: Record<string, { ring: string; bg: string; border: string; btn: string; label: string }> = {
  emerald: { ring: "focus:border-emerald-500 dark:focus:border-emerald-400", bg: "bg-emerald-50/40 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700", label: "text-emerald-700 dark:text-emerald-300" },
  purple: { ring: "focus:border-purple-500 dark:focus:border-purple-400", bg: "bg-purple-50/40 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700", btn: "bg-purple-600 hover:bg-purple-700", label: "text-purple-700 dark:text-purple-300" },
  indigo: { ring: "focus:border-indigo-500 dark:focus:border-indigo-400", bg: "bg-indigo-50/40 dark:bg-indigo-900/30", border: "border-indigo-300 dark:border-indigo-700", btn: "bg-indigo-600 hover:bg-indigo-700", label: "text-indigo-700 dark:text-indigo-300" },
};

const QUICK_DURATIONS = [
  { label: "Dài hạn (3 tháng)", months: 3, days: 0 },
  { label: "Trung hạn (30 ngày)", months: 0, days: 30 },
  { label: "Bình thường (15 ngày)", months: 0, days: 15 },
  { label: "Khẩn (3 ngày)", months: 0, days: 3 },
  { label: "Cấp bách (1 ngày)", months: 0, days: 1 },
];

export default function TaskInlineForm({ initialValues, onSubmit, onCancel, pending, eligibleUsers, accentColor = "indigo", size = "sm", showRecurring = false, title, planId, planName, plans }: Props) {
  const dim = SIZE[size];
  const col = ACCENT[accentColor] || ACCENT.indigo;
  const [name, setName] = useState(initialValues?.name || "");
  const [desc, setDesc] = useState(initialValues?.description || "");
  const [isAdHoc, setIsAdHoc] = useState(initialValues?.is_ad_hoc ?? initialValues?.category === "sudden");
  const [isHighImpact, setIsHighImpact] = useState(initialValues?.is_high_impact ?? initialValues?.category === "important");
  const [executor, setExecutor] = useState(initialValues?.executor_id || "");
  const [supervisor, setSupervisor] = useState(initialValues?.supervisor_id || "");
  const [collaborators, setCollaborators] = useState<string[]>(initialValues?.collaborator_ids?.filter((id) => id !== initialValues?.executor_id && id !== initialValues?.supervisor_id) || []);
  const [startDate, setStartDate] = useState(initialValues?.start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState(initialValues?.deadline?.slice(0, 10) || "");
  const [recurring, setRecurring] = useState(initialValues?.is_recurring || false);
  const [selectedPlanId, setSelectedPlanId] = useState(planId || "");
  const [error, setError] = useState("");

  const applyQuickDuration = (months: number, days: number) => {
    if (!startDate) { setError("Chọn ngày bắt đầu trước"); return; }
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    d.setMonth(d.getMonth() + months);
    setDeadline(d.toISOString().slice(0, 10));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !deadline || !executor) {
      setError("Vui lòng điền tên, người thực hiện, ngày bắt đầu và hạn chót");
      return;
    }
    if (new Date(deadline) < new Date(startDate)) {
      setError("Hạn chót phải sau ngày bắt đầu");
      return;
    }
    setError("");
    // Annotated so the literal union survives — otherwise the ternary widens to
    // `string` and the create-task payload has to be cast at every call site.
    const derivedCategory: TaskCategory = isAdHoc ? "sudden" : isHighImpact ? "important" : "normal";
    try {
      await onSubmit({
        name: name.trim(),
        description: desc,
        category: derivedCategory,
        is_ad_hoc: isAdHoc,
        is_high_impact: isHighImpact,
        executor_id: executor,
        supervisor_id: supervisor || undefined,
        collaborator_ids: collaborators,
        start_date: new Date(startDate).toISOString(),
        deadline: new Date(deadline).toISOString(),
        is_recurring: showRecurring ? recurring : undefined,
        plan_id: selectedPlanId || undefined,
      });
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`rounded-xl border ${col.border} ${col.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`font-bold ${col.label} ${dim.heading}`}>{title || "Thêm nhiệm vụ mới"}</span>
        <button type="button" onClick={onCancel} aria-label="Đóng" title="Đóng"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{error}</div>}
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nhiệm vụ *"
        className={`w-full rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600`} />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả (không bắt buộc)" rows={1}
        className={`w-full rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none resize-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600`} />
      {planId ? (
        <div className={`rounded-lg border border-slate-300 bg-slate-100 ${dim.field} text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
          {planName || "Đã chọn kế hoạch"}
        </div>
      ) : plans && plans.length > 0 ? (
        <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}
          className={`rounded-lg border border-slate-300 ${size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} ${col.ring} focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600`}>
          <option value="">Không thuộc kế hoạch</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <select value={executor} onChange={(e) => { setExecutor(e.target.value); setCollaborators((prev) => prev.filter((id) => id !== e.target.value)); }}
          className={`rounded-lg border border-slate-300 px-2 py-1.5 ${dim.field.replace("px-2.5", "px-2").replace("px-3", "px-2")} ${col.ring} focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600`}>
          <option value="">Người thực hiện *</option>
          {eligibleUsers.filter((u) => u.id !== supervisor && !collaborators.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <select value={supervisor} onChange={(e) => { setSupervisor(e.target.value); setCollaborators((prev) => prev.filter((id) => id !== e.target.value)); }}
          className={`rounded-lg border border-slate-300 px-2 py-1.5 ${dim.field.replace("px-2.5", "px-2").replace("px-3", "px-2")} ${col.ring} focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600`}>
          <option value="">Người giám sát</option>
          {(() => {
            const managers = eligibleUsers.filter((u) => u.expand?.role_id?.level === "management");
            const current = supervisor ? eligibleUsers.find((u) => u.id === supervisor) : undefined;
            if (current && !managers.some((u) => u.id === current.id)) managers.push(current);
            return managers
              .filter((u) => u.id !== executor && !collaborators.includes(u.id))
              .map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>);
          })()}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[10px] uppercase tracking-wide ${col.label} font-medium`}>Thời gian nhanh:</span>
        {QUICK_DURATIONS.map((q) => (
          <button key={q.label} type="button" onClick={() => applyQuickDuration(q.months, q.days)}
            className={`rounded-full border ${col.border} bg-white px-2 py-0.5 text-[10px] font-medium ${col.label} transition-colors hover:bg-white/70 dark:bg-slate-800 dark:hover:bg-white/10`}>
            {q.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className={`rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${dim.field} ${col.ring} focus:outline-none`} />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className={`rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${dim.field} ${col.ring} focus:outline-none`} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isAdHoc} onChange={(e) => setIsAdHoc(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
          Đột xuất
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isHighImpact} onChange={(e) => setIsHighImpact(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
          Quan trọng
        </label>
      </div>
      <CollaboratorSelect
        users={eligibleUsers}
        selected={collaborators}
        onToggle={(id) => setCollaborators((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        excludeIds={[executor, supervisor].filter(Boolean)}
        accentColor={accentColor}
        size={size}
        maxHeight={size === "sm" ? "5rem" : "6rem"}
      />
      {showRecurring && (
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
          Lặp lại
        </label>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className={`rounded-lg border border-slate-300 px-2.5 py-1 ${dim.heading} font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}>Hủy</button>
        <button type="submit" disabled={pending}
          className={`flex items-center gap-1 rounded-lg ${col.btn} px-2.5 py-1 ${dim.heading} font-semibold text-white transition disabled:opacity-50`}>
          {pending ? <Loader2 className={`animate-spin ${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}`} /> : <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          {title || "Tạo nhiệm vụ"}
        </button>
      </div>
    </form>
  );
}
