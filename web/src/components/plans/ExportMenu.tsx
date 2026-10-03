import { Download, FileSpreadsheet, FileText, FileJson, RectangleVertical, RectangleHorizontal } from "lucide-react";
import { useDismissableMenu } from "@/hooks/useDismissableMenu";

export type ExportFormat = "xlsx" | "csv" | "json" | "pdf";

interface ExportMenuProps {
  onExport: (format: ExportFormat, landscape?: boolean) => void;
  label?: string;
}

export default function ExportMenu({ onExport, label = "Xuất dữ liệu" }: ExportMenuProps) {
  const menu = useDismissableMenu();
  const { open } = menu;
  return (
    <div className="relative">
      <button onClick={menu.toggle} aria-label={label} {...menu.triggerProps}
        className="rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950">
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={menu.close} />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <button onClick={() => { onExport("xlsx"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Xuất Excel (.xlsx)
            </button>
            <button onClick={() => { onExport("csv"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300">
              <FileText className="h-4 w-4 text-blue-500" /> Xuất CSV (.csv)
            </button>
            <button onClick={() => { onExport("json"); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300">
              <FileJson className="h-4 w-4 text-amber-500" /> Xuất JSON (.json)
            </button>
            <button onClick={() => { onExport("pdf", false); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300">
              <RectangleVertical className="h-4 w-4 text-rose-500" /> Xuất PDF - khổ dọc
            </button>
            <button onClick={() => { onExport("pdf", true); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300">
              <RectangleHorizontal className="h-4 w-4 text-rose-500" /> Xuất PDF - khổ ngang
            </button>
          </div>
        </>
      )}
    </div>
  );
}
