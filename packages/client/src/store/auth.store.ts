import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@emp-billing/shared";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  updateAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        localStorage.setItem("access_token", accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updateAccessToken: (token) => {
        localStorage.setItem("access_token", token);
        set({ accessToken: token });
      },
    }),
    {
      name: "emp-billing-auth",
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);
