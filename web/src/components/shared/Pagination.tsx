import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  onChange,
  pageSize,
  onPageSizeChange,
  totalCount,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  pageSize: number;
  onPageSizeChange?: (s: number) => void;
  totalCount?: number;
  pageSizeOptions?: number[];
}) {
  const start = totalCount != null ? (page - 1) * pageSize + 1 : 0;
  const end = totalCount != null ? Math.min(page * pageSize, totalCount) : 0;

  const pageButtons = () => {
    const maxButtons = Math.min(totalPages, 5);
    return Array.from({ length: maxButtons }, (_, i) => {
      let p: number;
      if (totalPages <= 5) p = i + 1;
      else if (page <= 3) p = i + 1;
      else if (page >= totalPages - 2) p = totalPages - 4 + i;
      else p = page - 2 + i;
      return (
        <button key={p} onClick={() => onChange(p)}
          className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-medium transition-all duration-200 ${p === page ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/30" : "text-slate-600 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-white/5"}`}>{p}</button>
      );
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/30 dark:border-white/5 glass-light px-2 sm:px-3 py-1.5 rounded-b-2xl">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {onPageSizeChange && (
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} title="Số dòng/trang"
            className="rounded-lg glass-input px-2 py-1 text-[11px] focus:border-indigo-500 focus:outline-none">
            {pageSizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {totalCount != null && <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">{start}-{end} / {totalCount}</span>}
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg glass-input text-slate-600 hover:bg-white/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 dark:text-slate-400 dark:hover:bg-white/5" title="Trang trước">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageButtons()}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-lg glass-input text-slate-600 hover:bg-white/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 dark:text-slate-400 dark:hover:bg-white/5" title="Trang sau">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
