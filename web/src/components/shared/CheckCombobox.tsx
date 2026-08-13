import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface Item {
  id: string;
  label: string;
}

interface Props {
  items: Item[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
  placeholder?: string;
  accentColor?: string;
  size?: "sm" | "md";
}

const ACCENT: Record<string, { ring: string; checked: string }> = {
  emerald: { ring: "focus:border-emerald-500", checked: "text-emerald-600 border-emerald-400 bg-emerald-50" },
  indigo: { ring: "focus:border-indigo-500", checked: "text-indigo-600 border-indigo-400 bg-indigo-50" },
  purple: { ring: "focus:border-purple-500", checked: "text-purple-600 border-purple-400 bg-purple-50" },
};

export default function CheckCombobox({ items, selected, onToggle, label, placeholder = "Chọn...", accentColor = "indigo", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const col = ACCENT[accentColor] || ACCENT.indigo;
  const dim = size === "sm" ? "text-xs py-1.5 px-2.5" : "text-sm py-2 px-3";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((i) => i.id);
  if (!filtered.length) return null;

  return (
    <div ref={ref} className="relative">
      <p className={`mb-1 font-semibold text-slate-500 dark:text-slate-400 ${size === "sm" ? "text-[10px]" : "text-xs"}`}>{label}</p>
      <button type="button" onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg border border-slate-300 ${dim} ${col.ring} focus:outline-none bg-white text-left dark:border-slate-700 dark:bg-slate-800`}>
        <span className={selected.length > 0 ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
          {selected.length > 0 ? `Đã chọn ${selected.length}` : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform dark:text-slate-500 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto dark:border-slate-700 dark:bg-slate-800">
          {filtered.map((item) => {
            const isChecked = selected.includes(item.id);
            return (
              <label key={item.id}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors dark:hover:bg-slate-700 ${isChecked ? "font-medium text-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
                <input type="checkbox" checked={isChecked} onChange={() => onToggle(item.id)}
                  className={`rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 ${col.checked} focus:ring-0`} />
                {item.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
