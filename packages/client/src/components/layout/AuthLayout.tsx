import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow">
            <span className="text-white font-bold">EB</span>
          </div>
          <span className="text-xl font-bold text-gray-900">EMP Billing</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <Outlet />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} EmpCloud · Open-source billing platform
        </p>
      </div>
    </div>
  );
}
