import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import {
  LayoutDashboard, FileText, Receipt, CreditCard, LogOut,
  FileMinus, Calendar, AlertTriangle, Repeat, Wallet, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { usePortalStore } from "@/store/portal.store";
import { usePortalBranding } from "@/api/hooks/portal-branding.hooks";

const PORTAL_NAV = [
  { label: "Dashboard",      href: "/portal",                icon: LayoutDashboard },
  { label: "Invoices",       href: "/portal/invoices",       icon: FileText },
  { label: "Quotes",         href: "/portal/quotes",         icon: Receipt },
  { label: "Payments",       href: "/portal/payments",       icon: CreditCard },
  { label: "Credit Notes",   href: "/portal/credit-notes",   icon: FileMinus },
  { label: "Subscriptions",  href: "/portal/subscriptions",  icon: Repeat },
  { label: "Payment Method", href: "/portal/payment-method", icon: Wallet },
  { label: "Disputes",       href: "/portal/disputes",       icon: AlertTriangle },
  { label: "Statement",      href: "/portal/statements",     icon: Calendar },
];

function getOrgInitials(name: string | null): string {
  if (!name) return "P";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export function PortalLayout() {
  const store = usePortalStore();
  const { data: branding } = usePortalBranding();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Merge branding: authenticated store values take priority, fall back to public branding API
  const orgName = store.orgName || branding?.orgName || "EMP Billing";
  const logoUrl = store.logoUrl || branding?.logo || null;
  const brandPrimary = store.brandPrimary || branding?.primaryColor || null;
  const { isPortalAuthenticated, clientName, clearPortalAuth } = store;

  // Allow unauthenticated access to /portal/login
  const isLoginPage = location.pathname === "/portal/login";

  if (!isPortalAuthenticated && !isLoginPage) {
    return <Navigate to="/portal/login" replace />;
  }

  // Login page — same style as AuthLayout: gradient bg + card
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName}
                className="w-10 h-10 rounded-xl object-contain"
              />
            ) : (
              <div
                className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow",
                  !brandPrimary && "bg-brand-600"
                )}
                style={brandPrimary ? { backgroundColor: brandPrimary } : undefined}
              >
                <span className="text-white font-bold">
                  {getOrgInitials(orgName)}
                </span>
              </div>
            )}
            <span className="text-xl font-bold text-gray-900">{orgName}</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <Outlet />
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} {orgName} · Client Portal
          </p>
        </div>
      </div>
    );
  }

  // Authenticated layout — sidebar like DashboardLayout
  const accentBg = brandPrimary || undefined;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          "flex flex-col bg-gray-900 text-white transition-all duration-200 flex-shrink-0",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        {/* Logo */}
        <div className={clsx(
          "flex items-center h-14 border-b border-gray-700/50",
          sidebarOpen ? "px-3 justify-between" : "px-0 justify-center"
        )}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={orgName}
                    className="flex-shrink-0 w-8 h-8 rounded-lg object-contain"
                  />
                ) : (
                  <div
                    className={clsx(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      !accentBg && "bg-brand-600"
                    )}
                    style={accentBg ? { backgroundColor: accentBg } : undefined}
                  >
                    <span className="text-white font-bold text-sm">
                      {getOrgInitials(orgName)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-semibold text-sm truncate block">{orgName}</span>
                  <span className="text-xs text-gray-500 truncate block">Client Portal</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex-shrink-0 p-1 rounded hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-90 transition-colors",
                !accentBg && "bg-brand-600 hover:bg-brand-700"
              )}
              style={accentBg ? { backgroundColor: accentBg } : undefined}
              title="Expand sidebar"
            >
              {logoUrl ? (
                <img src={logoUrl} alt={orgName} className="w-6 h-6 rounded object-contain" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {getOrgInitials(orgName)}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {PORTAL_NAV.map(({ label, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              end={href === "/portal"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? (!accentBg ? "bg-brand-600 text-white" : "text-white")
                    : "text-gray-400 hover:bg-gray-700/60 hover:text-white"
                )
              }
              style={({ isActive }) =>
                isActive && accentBg
                  ? { backgroundColor: accentBg }
                  : undefined
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-2 py-3 border-t border-gray-700/50">
          {sidebarOpen && clientName && (
            <div className="px-2 py-1.5 mb-1">
              <p className="text-xs font-medium text-white truncate">{clientName}</p>
              <p className="text-xs text-gray-500 truncate">Client</p>
            </div>
          )}
          <button
            onClick={clearPortalAuth}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-700/60 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors mr-3"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h2 className="text-sm font-medium text-gray-500">Client Portal</h2>
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:block">{clientName}</span>
            <div
              className={clsx(
                "w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs",
                !accentBg && "bg-brand-600"
              )}
              style={accentBg ? { backgroundColor: accentBg } : undefined}
            >
              {clientName ? clientName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "C"}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
