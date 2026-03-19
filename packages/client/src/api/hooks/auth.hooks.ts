import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiPost } from "../client";
import { useAuthStore } from "@/store/auth.store";
import type { AuthUser } from "@emp-billing/shared";

interface LoginResponse { accessToken: string; user: AuthUser; }
interface RegisterResponse { accessToken: string; user: AuthUser; }

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiPost<LoginResponse>("/auth/login", data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setAuth(res.data.user, res.data.accessToken);
        navigate("/dashboard");
      }
    },
    onError: () => toast.error("Invalid email or password"),
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiPost<RegisterResponse>("/auth/register", data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setAuth(res.data.user, res.data.accessToken);
        navigate("/dashboard");
        toast.success("Welcome! Your account is ready.");
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || "Registration failed");
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiPost("/auth/logout"),
    onSettled: () => {
      clearAuth();
      navigate("/login");
    },
  });
}
