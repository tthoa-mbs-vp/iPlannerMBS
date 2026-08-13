import { create } from "zustand";

interface HeaderBadge {
  label: string;
  className: string;
}

interface HeaderConfig {
  title: string;
  backTo?: string | (() => void) | null;
  badge?: HeaderBadge | null;
}

interface PageTitleState {
  title: string;
  backTo: string | (() => void) | null;
  badge: HeaderBadge | null;
  setTitle: (title: string) => void;
  setConfig: (config: HeaderConfig) => void;
  clear: () => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: "",
  backTo: null,
  badge: null,
  setTitle: (title) => set({ title }),
  setConfig: ({ title, backTo, badge }) => set({ title, backTo: backTo ?? null, badge: badge ?? null }),
  clear: () => set({ title: "", backTo: null, badge: null }),
}));
