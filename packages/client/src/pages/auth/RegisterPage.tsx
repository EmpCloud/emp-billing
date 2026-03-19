import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { RegisterSchema } from "@emp-billing/shared";
import { useRegister } from "@/api/hooks/auth.hooks";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import type { z } from "zod";

type FormData = z.infer<typeof RegisterSchema>;

export function RegisterPage() {
  const register_ = useRegister();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { country: "IN", currency: "INR" },
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
        <p className="text-sm text-gray-500 mt-1">Start billing in minutes — free forever</p>
      </div>

      <form onSubmit={handleSubmit((d) => register_.mutate(d as Record<string, string>))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" required error={errors.firstName?.message} {...register("firstName")} />
          <Input label="Last name" required error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Input label="Work email" type="email" required autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Organization name" required placeholder="Acme Corp" error={errors.orgName?.message} {...register("orgName")} />
        <Input label="Password" type="password" required autoComplete="new-password"
          hint="Min 8 chars, one uppercase, one number"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" className="w-full" loading={register_.isPending} size="lg">
          Create free account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
