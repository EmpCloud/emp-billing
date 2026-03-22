import { useState } from "react";
import { usePortalLogin } from "@/api/hooks/portal.hooks";
import { usePortalBranding } from "@/api/hooks/portal-branding.hooks";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";

export function PortalLoginPage() {
  const login = usePortalLogin();
  const { data: branding } = usePortalBranding();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  const orgName = branding?.orgName ?? "EMP Billing";
  const logo = branding?.logo;
  const primaryColor = branding?.primaryColor;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, token });
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        {logo ? (
          <img
            src={logo}
            alt={orgName}
            className="w-12 h-12 rounded-xl object-contain mx-auto mb-4"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${!primaryColor ? "bg-brand-600" : ""}`}
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          >
            <span className="text-white font-bold text-lg">
              {orgName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{orgName}</h1>
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

        <Button
          type="submit"
          className="w-full"
          loading={login.isPending}
          size="lg"
          style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
        >
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
