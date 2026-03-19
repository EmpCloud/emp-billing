import { clsx } from "clsx";
import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  color?: "default" | "green" | "red" | "yellow" | "blue" | "purple";
}

export function StatsCard({ label, value, sub, icon, trend, color = "default" }: StatsCardProps) {
  const iconColors = {
    default: "bg-gray-100 text-gray-600",
    green:   "bg-green-100 text-green-600",
    red:     "bg-red-100 text-red-600",
    yellow:  "bg-amber-100 text-amber-600",
    blue:    "bg-blue-100 text-blue-600",
    purple:  "bg-brand-100 text-brand-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      {icon && (
        <div className={clsx("flex-shrink-0 p-2.5 rounded-lg", iconColors[color])}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        {trend && (
          <p className={clsx("text-xs mt-1 font-medium", trend.positive ? "text-green-600" : "text-red-600")}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
