import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { Spinner } from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary:   "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500",
      secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 focus:ring-brand-300",
      ghost:     "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-300",
      danger:    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
      outline:   "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-5 py-2.5 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
