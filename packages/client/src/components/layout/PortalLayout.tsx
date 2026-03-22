import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import { LayoutDashboard, FileText, Receipt, CreditCard, LogOut, FileMinus, Calendar, AlertTriangle, Repeat, Wallet } from "lucide-react";
import { usePortalStore } from "@/store/portal.store";
import { usePortalBranding } from "@/api/hooks/portal-branding.hooks";

const PORTAL_NAV = [
  { label: "Dashboard",    href: "/portal",               icon: LayoutDashboard },
  { label: "Invoices",     href: "/portal/invoices",       icon: FileText },
  { label: "Quotes",       href: "/portal/quotes",         icon: Receipt },
  { label: "Payments",     href: "/portal/payments",        icon: CreditCard },
  { label: "Credit Notes", href: "/portal/credit-notes",   icon: FileMinus },
  { label: "Subscriptions", href: "/portal/subscriptions",  icon: Repeat },
  { label: "Payment Method", href: "/portal/payment-method", icon: Wallet },
  { label: "Disputes",     href: "/portal/disputes",       icon: AlertTriangle },
  { label: "Statement",    href: "/portal/statements",     icon: Calendar },
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

  // On login page, render just the outlet without nav
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Org info */}
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={orgName}
                  className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                />
              ) : (
                <div
                  className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    !brandPrimary && "bg-brand-600"
                  )}
                  style={brandPrimary ? { backgroundColor: brandPrimary } : undefined}
                >
                  <span className="text-white font-bold text-sm">
                    {getOrgInitials(orgName)}
                  </span>
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{orgName}</p>
                <p className="text-xs text-gray-500 leading-tight">Client Portal</p>
              </div>
            </div>

            {/* Center: Nav links */}
            <nav className="flex items-center gap-1">
              {PORTAL_NAV.map(({ label, href, icon: Icon }) => (
                <NavLink
                  key={href}
                  to={href}
                  end={href === "/portal"}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? (!brandPrimary ? "bg-brand-50 text-brand-700" : "")
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )
                  }
                  style={({ isActive }) =>
                    isActive && brandPrimary
                      ? { backgroundColor: `${brandPrimary}14`, color: brandPrimary }
                      : undefined
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Right: Client name + logout */}
            <div className="flex items-center gap-3">
              {clientName && (
                <span className="text-sm text-gray-600 hidden sm:block">{clientName}</span>
              )}
              <button
                onClick={clearPortalAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
