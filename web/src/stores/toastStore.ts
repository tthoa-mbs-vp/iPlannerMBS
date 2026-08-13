import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const TOAST_DURATION = 4000;

export const useToastStore = create<ToastState>((set) => {
  let counter = 0;
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    toasts: [],
    addToast: (type, message) => {
      const id = `toast-${++counter}`;
      set((s) => ({ toasts: [...s.toasts.slice(-4), { id, type, message }] }));
      const timeout = setTimeout(() => {
        timeouts.delete(id);
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, TOAST_DURATION);
      timeouts.set(id, timeout);
    },
    removeToast: (id) => {
      const timeout = timeouts.get(id);
      if (timeout) { clearTimeout(timeout); timeouts.delete(id); }
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});
