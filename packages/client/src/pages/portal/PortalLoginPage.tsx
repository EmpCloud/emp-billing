import { useState } from "react";
import { usePortalLogin } from "@/api/hooks/portal.hooks";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";

export function PortalLoginPage() {
  const login = usePortalLogin();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, token });
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-lg">EB</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and access token to sign in
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="Access Token"
          type="text"
          placeholder="Paste your access token"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          hint="This token was sent to you via email"
        />

        <Button type="submit" className="w-full" loading={login.isPending} size="lg">
          Sign in to Portal
        </Button>

        {login.isError && (
          <p className="text-sm text-center text-red-600">
            Invalid email or access token
          </p>
        )}
      </form>
    </div>
  );
}
