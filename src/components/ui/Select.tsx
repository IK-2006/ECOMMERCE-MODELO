"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-10 w-full cursor-pointer rounded-none border bg-white px-3 text-sm text-zinc-900 shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
            "dark:bg-zinc-900 dark:text-zinc-100",
            error ? "border-red-400 dark:border-red-600" : "border-zinc-300 dark:border-zinc-700",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
