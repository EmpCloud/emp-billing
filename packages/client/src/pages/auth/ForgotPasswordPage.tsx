import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "@/api/client";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { Mail, ArrowLeft } from "lucide-react";

const ForgotSchema = z.object({
  email: z.string().email("Valid email required"),
});

type FormData = z.infer<typeof ForgotSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(ForgotSchema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: data.email });
    } catch {
      // Always show success — don't reveal whether the account exists
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500">
            If an account with that email exists, we've sent a password reset link.
          </p>
        </div>

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Button type="submit" className="w-full" loading={loading} size="lg">
          Send Reset Link
        </Button>
      </form>

      <p className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </p>
    </>
  );
}
