import { Outlet, NavLink, Navigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  LayoutDashboard, Users, FileText, Receipt, CreditCard,
  ShoppingBag, BarChart3, Settings, Menu, X, LogOut,
  TrendingUp, ChevronRight, FileMinus, RefreshCw, Webhook,
  Users2, ClipboardList, Building2, MessageSquareWarning,
  AlertCircle, Repeat, Ticket, Activity,
} from "lucide-react";
import { useUIStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { useLogout } from "@/api/hooks/auth.hooks";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { NotificationCenter } from "@/components/common/NotificationCenter";

const NAV = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Clients",    href: "/clients",     icon: Users },
  { label: "Invoices",   href: "/invoices",    icon: FileText },
  { label: "Payments",   href: "/payments",    icon: CreditCard },
  { label: "Quotes",     href: "/quotes",      icon: Receipt },
  { label: "Credit Notes", href: "/credit-notes", icon: FileMinus },
  { label: "Expenses",   href: "/expenses",    icon: TrendingUp },
  { label: "Vendors",    href: "/vendors",     icon: Building2 },
  { label: "Products",   href: "/products",    icon: ShoppingBag },
  { label: "Recurring",  href: "/recurring",   icon: RefreshCw },
  { label: "Subscriptions", href: "/subscriptions", icon: Repeat },
  { label: "Usage",       href: "/usage",        icon: Activity },
  { label: "Coupons",    href: "/coupons",     icon: Ticket },
  { label: "Dunning",    href: "/dunning",     icon: AlertCircle },
  { label: "Disputes",   href: "/disputes",    icon: MessageSquareWarning },
  { label: "SaaS Metrics", href: "/metrics",   icon: TrendingUp },
  { label: "Reports",    href: "/reports",     icon: BarChart3 },
  { label: "Webhooks",   href: "/webhooks",    icon: Webhook },
  { label: "Team",       href: "/team",        icon: Users2 },
  { label: "Activity",   href: "/activity",    icon: ClipboardList },
  { label: "Settings",   href: "/settings",    icon: Settings },
];

export function DashboardLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const logout = useLogout();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

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
                <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">EB</span>
                </div>
                <span className="font-semibold text-sm truncate">EMP Billing</span>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex-shrink-0 p-1 rounded hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center hover:bg-brand-700 transition-colors"
              title="Expand sidebar"
            >
              <span className="text-white font-bold text-sm">EB</span>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV.map(({ label, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-gray-400 hover:bg-gray-700/60 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-2 py-3 border-t border-gray-700/50">
          {sidebarOpen && user && (
            <div className="px-2 py-1.5 mb-1">
              <p className="text-xs font-medium text-white truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500 truncate">{user.orgName}</p>
            </div>
          )}
          <button
            onClick={() => logout.mutate()}
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
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3 text-sm text-gray-600">
            <NotificationCenter />
            <span className="hidden sm:block">{user?.orgName}</span>
            <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
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
