import { useToastStore, type ToastType } from "../../stores/toastStore";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const TOAST_CONFIG: Record<ToastType, { icon: typeof CheckCircle2; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  error: { icon: AlertCircle, bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  info: { icon: Info, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const cfg = TOAST_CONFIG[t.type];
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 shadow-lg animate-in slide-in-from-right-2 fade-in`}
          >
            <Icon className={`h-5 w-5 ${cfg.text}`} />
            <p className={`text-sm font-medium ${cfg.text}`}>{t.message}</p>
            <button onClick={() => removeToast(t.id)} className={`ml-2 ${cfg.text} hover:opacity-70`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
