import { useState } from "react";
import { Link } from "react-router-dom";
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
    <>
      <div className="mb-6">
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
        />

        <p className="text-xs text-gray-400">
          This token was provided by your billing contact
        </p>

        <Button
          type="submit"
          className="w-full"
          loading={login.isPending}
          size="lg"
        >
          Sign in to Portal
        </Button>

        {login.isError && (
          <p className="text-sm text-center text-red-600">
            Invalid email or access token
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Admin user?{" "}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">
          Sign in here
        </Link>
      </p>
    </>
  );
}
