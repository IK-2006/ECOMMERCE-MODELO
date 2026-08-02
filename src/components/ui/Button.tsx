"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  secondary:
    "bg-accent text-white hover:bg-accent-strong focus-visible:ring-accent",
  outline:
    "border border-zinc-900 bg-transparent text-zinc-900 hover:bg-zinc-900 hover:text-white focus-visible:ring-zinc-900 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900",
  ghost:
    "bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800",
  danger:
    "border border-red-600 bg-transparent text-red-600 hover:bg-red-600 hover:text-white focus-visible:ring-red-500",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-11 px-6 text-xs",
  lg: "h-12 px-8 text-xs",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium uppercase tracking-[0.14em] transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
