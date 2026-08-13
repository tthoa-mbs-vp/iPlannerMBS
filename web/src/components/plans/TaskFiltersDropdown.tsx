import { useState } from "react";
import { Search, Filter } from "lucide-react";
import CheckCombobox from "../shared/CheckCombobox";
import type { TaskStatus, User } from "@shared/types";
import { TASK_STATUS_LABELS } from "../../utils/constants";

interface TaskFiltersDropdownProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  searchFilter: string;
  onSearchChange: (v: string) => void;
  deadlineFrom: string;
  onDeadlineFromChange: (v: string) => void;
  deadlineTo: string;
  onDeadlineToChange: (v: string) => void;
  personFilters: string[];
  onPersonToggle: (id: string) => void;
  personOptions: User[];
  onClear: () => void;
}

export default function TaskFiltersDropdown({
  statusFilter, onStatusChange, searchFilter, onSearchChange,
  deadlineFrom, onDeadlineFromChange, deadlineTo, onDeadlineToChange,
  personFilters, onPersonToggle, personOptions, onClear,
}: TaskFiltersDropdownProps) {
  const [open, setOpen] = useState(false);
  const hasActive = !!(statusFilter || searchFilter || deadlineFrom || deadlineTo || personFilters.length > 0);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} title="Bộ lọc nhiệm vụ"
        className={`relative rounded-lg border p-1.5 transition-colors ${hasActive ? "border-purple-300 bg-purple-100 text-purple-600" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
        <Filter className="h-4 w-4" />
        {hasActive && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-purple-500" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input value={searchFilter} onChange={(e) => onSearchChange(e.target.value)} aria-label="Tìm nhiệm vụ"
                placeholder="Tìm nhiệm vụ..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
            </div>
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900">
              <input type="date" value={deadlineFrom} onChange={(e) => onDeadlineFromChange(e.target.value)}
                className="w-[105px] border-none bg-transparent p-0 text-xs text-slate-700 focus:outline-none dark:text-slate-200" title="Từ ngày" />
              <span className="text-slate-300 dark:text-slate-600">—</span>
              <input type="date" value={deadlineTo} onChange={(e) => onDeadlineToChange(e.target.value)}
                className="w-[105px] border-none bg-transparent p-0 text-xs text-slate-700 focus:outline-none dark:text-slate-200" title="Đến ngày" />
            </div>
            <div className="mt-2 space-y-2">
              <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} aria-label="Lọc theo trạng thái"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Tất cả trạng thái</option>
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <CheckCombobox
                items={personOptions.map((u) => ({ id: u.id, label: u.name || u.email }))}
                selected={personFilters}
                onToggle={onPersonToggle}
                label="Nhân sự"
                placeholder="Tất cả nhân sự"
                accentColor="purple"
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
