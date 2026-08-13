import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import type { Department, ProfessionalGroup } from "@shared/types";
import CheckCombobox from "../shared/CheckCombobox";

interface UserBrief {
  id: string;
  name?: string;
  email?: string;
  expand?: { role_id?: { level?: string } };
}

interface Props {
  initialValues?: {
    name?: string;
    description?: string;
    host_dept_id?: string;
    leader_id?: string;
    partner_dept_ids?: string[];
    group_id?: string;
    start_date?: string;
    end_date?: string;
    is_sudden?: boolean;
    is_high_impact?: boolean;
  };
  onSubmit: (data: {
    name: string;
    description?: string;
    host_dept_id?: string;
    leader_id?: string;
    partner_dept_ids?: string[];
    group_id?: string;
    start_date: string;
    end_date: string;
    is_sudden: boolean;
    is_high_impact: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  departments?: Department[];
  users?: UserBrief[];
  groups?: ProfessionalGroup[];
  accentColor?: string;
  size?: "sm" | "md";
  showId?: string;
  title?: string;
}

const SIZE: Record<"sm" | "md", { field: string; label: string; heading: string; grid: string }> = {
  sm: { field: "px-2.5 py-1.5 text-xs", label: "text-[10px]", heading: "text-xs", grid: "gap-2" },
  md: { field: "px-3 py-2 text-sm", label: "text-xs", heading: "text-sm", grid: "gap-3" },
};

const ACCENT: Record<string, { ring: string; bg: string; border: string; btn: string; heading: string; dark: string }> = {
  emerald: { ring: "focus:border-emerald-500", bg: "bg-emerald-50/40", border: "border-emerald-300", btn: "bg-emerald-600 hover:bg-emerald-700", heading: "text-emerald-700", dark: "dark:border-emerald-800 dark:bg-emerald-950/40" },
  indigo: { ring: "focus:border-indigo-500", bg: "bg-indigo-50/40", border: "border-indigo-300", btn: "bg-indigo-600 hover:bg-indigo-700", heading: "text-indigo-700", dark: "dark:border-indigo-800 dark:bg-indigo-950/40" },
};

export default function PlanInlineForm({ initialValues, onSubmit, onCancel, pending, departments, users, groups, accentColor = "emerald", size = "sm", showId, title }: Props) {
  const dim = SIZE[size];
  const col = ACCENT[accentColor] || ACCENT.emerald;

  const [name, setName] = useState(initialValues?.name || "");
  const [desc, setDesc] = useState(initialValues?.description || "");
  const [hostDept, setHostDept] = useState(initialValues?.host_dept_id || "");
  const [leader, setLeader] = useState(initialValues?.leader_id || "");
  const [partnerDepts, setPartnerDepts] = useState<string[]>(initialValues?.partner_dept_ids?.filter((id) => id !== initialValues?.host_dept_id) || []);
  const [group, setGroup] = useState(initialValues?.group_id || "");
  const [startDate, setStartDate] = useState(initialValues?.start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialValues?.end_date?.slice(0, 10) || "");
  const [sudden, setSudden] = useState(initialValues?.is_sudden || false);
  const [highImpact, setHighImpact] = useState(initialValues?.is_high_impact || false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError("Vui lòng điền các trường bắt buộc");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        description: desc,
        host_dept_id: hostDept || undefined,
        leader_id: leader || undefined,
        partner_dept_ids: partnerDepts.length > 0 ? partnerDepts : undefined,
        group_id: group || undefined,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        is_sudden: sudden,
        is_high_impact: highImpact,
      });
    } catch (err: any) {
      setError(err?.message || "Có lỗi xảy ra");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`rounded-xl border ${col.border} ${col.bg} ${col.dark} p-3 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <span className={`font-bold ${col.heading} ${dim.heading}`}>
          {title || (showId ? "Sửa kế hoạch" : "Thêm kế hoạch mới")}
        </span>
        {showId && <span className="text-[10px] text-slate-400 dark:text-slate-500">ID: {showId}</span>}
        <button type="button" onClick={onCancel}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">{error}</div>}
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên kế hoạch *"
        className={`w-full rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`} />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả (không bắt buộc)" rows={2}
        className={`w-full rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 resize-none`} />
      <div className={`grid grid-cols-2 ${dim.grid}`}>
        <select value={hostDept} onChange={(e) => { setHostDept(e.target.value); setGroup(""); setPartnerDepts((prev) => prev.filter((id) => id !== e.target.value)); }}
          className={`rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}>
          <option value="">Phòng chủ trì *</option>
          {departments?.filter((d) => d.is_counted).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={leader} onChange={(e) => setLeader(e.target.value)}
          className={`rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}>
          <option value="">Lãnh đạo</option>
          {(() => {
            const leaders = (users || []).filter((u) => u.expand?.role_id?.level === "leadership");
            const current = leader ? (users || []).find((u) => u.id === leader) : undefined;
            if (current && !leaders.some((u) => u.id === current.id)) leaders.push(current);
            return leaders.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>);
          })()}
        </select>
      </div>
      {groups && groups.filter((g) => !g.department_id || g.department_id === hostDept).length > 0 && (
        <select value={group} onChange={(e) => setGroup(e.target.value)}
          className={`w-full rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}>
          <option value="">Tổ chuyên môn (không bắt buộc)</option>
          {groups
            .filter((g) => !g.department_id || g.department_id === hostDept)
            .map((g) => <option key={g.id} value={g.id}>{g.code} - {g.name}{g.department_id ? "" : " (độc lập)"}</option>)}
        </select>
      )}
      {departments && departments.filter((d) => d.is_counted && d.id !== hostDept).length > 0 && (
        <CheckCombobox
          items={departments.filter((d) => d.is_counted && d.id !== hostDept).map((d) => ({ id: d.id, label: d.name }))}
          selected={partnerDepts}
          onToggle={(id) => setPartnerDepts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
          label="Phòng phối hợp"
          placeholder="Chọn phòng phối hợp..."
          accentColor={accentColor}
          size={size}
        />
      )}
      <div className={`grid grid-cols-2 ${dim.grid}`}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className={`rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className={`rounded-lg border border-slate-300 ${dim.field} ${col.ring} focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`} />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={sudden} onChange={(e) => setSudden(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
          Đột xuất
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={highImpact} onChange={(e) => setHighImpact(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800" />
          Tác động lớn
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className={`rounded-lg border border-slate-300 px-3 py-1 ${dim.heading} font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800`}>Hủy</button>
        <button type="submit" disabled={pending}
          className={`flex items-center gap-1 rounded-lg ${col.btn} px-3 py-1 ${dim.heading} font-semibold text-white transition disabled:opacity-50`}>
          {pending ? <Loader2 className={`animate-spin ${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}`} /> : <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          {title ? "Lưu thay đổi" : showId ? "Lưu thay đổi" : "Tạo kế hoạch"}
        </button>
      </div>
    </form>
  );
}
