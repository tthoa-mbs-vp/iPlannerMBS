import { useState } from "react";
import { Search, Filter } from "lucide-react";
import CheckCombobox from "../shared/CheckCombobox";
import type { Department, ProfessionalGroup, PlanStatus } from "@shared/types";
import { PLAN_STATUS_LABELS } from "../../utils/constants";

interface PlanFiltersDropdownProps {
  search: string;
  onSearchChange: (v: string) => void;
  deptFilters: string[];
  onDeptToggle: (id: string) => void;
  groupFilters: string[];
  onGroupToggle: (id: string) => void;
  statusFilters: string[];
  onStatusToggle: (id: string) => void;
  departments?: Department[];
  groups?: ProfessionalGroup[];
  onClear: () => void;
}

export default function PlanFiltersDropdown({
  search, onSearchChange, deptFilters, onDeptToggle, groupFilters, onGroupToggle, statusFilters, onStatusToggle, departments, groups, onClear,
}: PlanFiltersDropdownProps) {
  const [open, setOpen] = useState(false);
  const hasActive = !!(search || deptFilters.length > 0 || groupFilters.length > 0 || statusFilters.length > 0);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} title="Bộ lọc kế hoạch"
        className={`relative rounded-lg border p-1.5 transition-colors ${hasActive ? "border-indigo-300 bg-indigo-100 text-indigo-600" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
        <Filter className="h-4 w-4" />
        {hasActive && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input value={search} onChange={(e) => onSearchChange(e.target.value)} aria-label="Tìm kiếm kế hoạch"
                placeholder="Tìm kiếm..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
            </div>
            <div className="mt-2 space-y-2">
              <CheckCombobox
                items={(departments || []).map((d) => ({ id: d.id, label: d.name }))}
                selected={deptFilters}
                onToggle={onDeptToggle}
                label="Phòng ban"
                placeholder="Tất cả phòng ban"
                accentColor="indigo"
                size="sm"
              />
              <CheckCombobox
                items={(groups || [])
                  .filter((g) => deptFilters.length === 0 || !g.department_id || deptFilters.includes(g.department_id))
                  .map((g) => ({ id: g.id, label: `${g.code} - ${g.name}` }))}
                selected={groupFilters}
                onToggle={onGroupToggle}
                label="Tổ chuyên môn"
                placeholder="Tất cả tổ"
                accentColor="indigo"
                size="sm"
              />
              <CheckCombobox
                items={(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => ({ id: s, label: PLAN_STATUS_LABELS[s] }))}
                selected={statusFilters}
                onToggle={onStatusToggle}
                label="Trạng thái"
                placeholder="Tất cả trạng thái"
                accentColor="indigo"
                size="sm"
              />
            </div>
            {hasActive && (
              <button onClick={() => { onClear(); setOpen(false); }}
                className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors">
                Xóa lọc
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
