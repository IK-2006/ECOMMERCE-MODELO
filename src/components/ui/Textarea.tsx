"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const autoId = useId();
    const areaId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            "min-h-24 w-full rounded-none border bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm",
            "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
            "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
            error ? "border-red-400 dark:border-red-600" : "border-zinc-300 dark:border-zinc-700",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
