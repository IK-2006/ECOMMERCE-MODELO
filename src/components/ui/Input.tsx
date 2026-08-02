"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "h-10 w-full rounded-none border bg-white px-3 text-sm text-zinc-900 shadow-sm transition-colors",
            "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
            "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
            error
              ? "border-red-400 dark:border-red-600"
              : "border-zinc-300 dark:border-zinc-700",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
