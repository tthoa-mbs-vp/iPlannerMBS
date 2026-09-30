import { Download, FileSpreadsheet, FileText, FileJson } from "lucide-react";
import { useDismissableMenu } from "@/hooks/useDismissableMenu";

type ExportFormat = "xlsx" | "csv" | "json";

interface Props {
  onExport: (format: ExportFormat) => void;
  label?: string;
}

export default function ExportButton({ onExport, label = "Xuất" }: Props) {
  const menu = useDismissableMenu();
  const { open } = menu;

  return (
    <div className="relative">
      <button
        onClick={menu.toggle}
        {...menu.triggerProps}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={menu.close} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => { onExport("xlsx"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Xuất Excel (.xlsx)
            </button>
            <button
              onClick={() => { onExport("csv"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300"
            >
              <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              Xuất CSV (.csv)
            </button>
            <button
              onClick={() => { onExport("json"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300"
            >
              <FileJson className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              Xuất JSON (.json)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
