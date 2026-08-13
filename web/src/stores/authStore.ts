import { create } from "zustand";
import { pb, setRememberMe } from "../api/client";
import type { User } from "@shared/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string, remember = true) => {
    setRememberMe(remember);
    const authData = await pb
      .collection("users")
      .authWithPassword(email, password);
    const user = await pb.collection("users").getOne(authData.record.id, {
      expand: "department_id,role_id,group_ids",
    });
    if ((user as unknown as User).disabled) {
      pb.authStore.clear();
      set({ user: null, isAuthenticated: false });
      throw new Error("Tài khoản đã bị vô hiệu hóa");
    }
    set({
      user: user as unknown as User,
      isAuthenticated: true,
    });
  },

  logout: () => {
    pb.authStore.clear();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const isAuth = pb.authStore.isValid;

    if (isAuth && pb.authStore.model?.id) {
      const rememberPref = localStorage.getItem("pb_remember");
      const isRemembered = rememberPref === null || rememberPref === "1";
      const inSession = sessionStorage.getItem("pb_session_only") === "1";

      // Session-only mode in a new browser session → clear
      if (!isRemembered && !inSession) {
        pb.authStore.clear();
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      try {
        const user = await pb.collection("users").getOne(pb.authStore.model.id, {
          expand: "department_id,role_id,group_ids",
          requestKey: "checkAuth-user",
        });
        if ((user as unknown as User).disabled) {
          pb.authStore.clear();
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({
          user: user as unknown as User,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err: unknown) {
        if ((err as Record<string, unknown>)?.cancel === true) return;
        pb.authStore.clear();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
