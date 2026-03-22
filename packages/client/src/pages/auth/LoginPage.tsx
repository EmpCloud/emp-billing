import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { LoginSchema } from "@emp-billing/shared";
import { useLogin } from "@/api/hooks/auth.hooks";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import type { z } from "zod";

type FormData = z.infer<typeof LoginSchema>;

export function LoginPage() {
  const login = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: import.meta.env.DEV
      ? { email: "admin@acme.com", password: "Admin@123" }
      : { email: "", password: "" },
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back — sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end">
          <a href="/forgot-password" className="text-xs text-brand-600 hover:underline">
            Forgot password?
          </a>
        </div>

        <Button type="submit" className="w-full" loading={login.isPending} size="lg">
          Sign in
        </Button>

        {login.isError && (
          <p className="text-sm text-center text-red-600">Invalid email or password</p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand-600 font-medium hover:underline">
          Create one free
        </Link>
      </p>

      {/* Dev hint */}
      {import.meta.env.DEV && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
          <strong>Demo:</strong> admin@acme.com / Admin@123
        </div>
      )}
    </>
  );
}
