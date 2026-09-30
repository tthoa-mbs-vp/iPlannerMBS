import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  accentColor?: string;
}

const MAX_WIDTH: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

const ACCENT_BG: Record<string, string> = {
  indigo: "bg-gradient-to-r from-indigo-600 to-blue-600",
  emerald: "bg-gradient-to-r from-emerald-600 to-teal-600",
  amber: "bg-gradient-to-r from-amber-500 to-orange-600",
  purple: "bg-gradient-to-r from-purple-600 to-violet-600",
  rose: "bg-gradient-to-r from-rose-500 to-pink-600",
  slate: "bg-gradient-to-r from-slate-700 to-slate-600",
};

const ACCENT_BG_ALT: Record<string, string> = {
  indigo: "from-indigo-50/30 to-blue-50/20",
  emerald: "from-emerald-50/30 to-teal-50/20",
  amber: "from-amber-50/30 to-orange-50/20",
  purple: "from-purple-50/30 to-violet-50/20",
  rose: "from-rose-50/30 to-pink-50/20",
  slate: "from-slate-50/30 to-slate-100/20",
};

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = "xl",
  accentColor = "indigo",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Remember what had focus so the keyboard user lands back where they were
    // after the dialog closes — without this, focus falls to <body> and
    // Tab-from-the-top restarts the whole page, losing the user's place.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Elements a keyboard user can actually reach. Visibility is checked via
    // attributes rather than getClientRects()/offsetParent: those need a layout
    // engine, so they report "hidden" for everything under jsdom and would
    // silently empty the trap during tests.
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hidden && el.getAttribute("aria-hidden") !== "true"
      );

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: without it, Tab walks straight out of the dialog and into
      // the page behind, so screen-reader and keyboard users end up editing
      // an invisible layer.
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && panelRef.current?.contains(active);

      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handler);
    const timer = window.setTimeout(() => {
      const items = focusables();
      // Prefer the first form control; fall back to any focusable element.
      const preferred = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), select, textarea"
      );
      (preferred && items.includes(preferred) ? preferred : items[0])?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handler);
      window.clearTimeout(timer);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          className={`w-full ${MAX_WIDTH[maxWidth]} my-8 rounded-2xl bg-white shadow-2xl shadow-black/20 border border-white/10 animate-[fadeIn_0.2s_ease-out] dark:bg-slate-900 dark:border-slate-700`}
        >
          <div className={`flex items-center justify-between ${ACCENT_BG[accentColor]} rounded-t-2xl px-6 py-4`}>
            <h3 id={titleId} className="text-lg font-bold text-white drop-shadow-sm">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className={`${ACCENT_BG_ALT[accentColor]} bg-gradient-to-b`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
