import { FileText, ChevronDown, RectangleVertical, RectangleHorizontal } from "lucide-react";
import { useDismissableMenu } from "@/hooks/useDismissableMenu";

interface PdfExportMenuProps {
  onExport: (landscape: boolean) => void;
  label?: string;
}

export default function PdfExportMenu({ onExport, label = "Xuất PDF" }: PdfExportMenuProps) {
  const menu = useDismissableMenu();
  const { open } = menu;
  return (
    <div className="relative">
      <button onClick={menu.toggle} aria-label={label} {...menu.triggerProps}
        className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-100 transition-all hover:scale-[1.02] active:scale-95 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50">
        <FileText className="h-4 w-4" aria-hidden="true" />
        {label}
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={menu.close} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => { onExport(false); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300">
              <RectangleVertical className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Khổ dọc (Portrait)
            </button>
            <button onClick={() => { onExport(true); menu.close(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300">
              <RectangleHorizontal className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Khổ ngang (Landscape)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
