"use client";

import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  count,
  size = "sm",
  onChange,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  /** quando definido, vira um seletor interativo (formulário de avaliação) */
  onChange?: (value: number) => void;
}) {
  const sizeClass = { sm: "size-3", md: "size-4", lg: "size-5" }[size];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(star)}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            className={cn(onChange && "cursor-pointer transition-transform hover:scale-110")}
          >
            <svg
              viewBox="0 0 20 20"
              className={cn(
                sizeClass,
                star <= Math.round(value)
                  ? "fill-zinc-800 dark:fill-zinc-200"
                  : "fill-zinc-200 dark:fill-zinc-700"
              )}
            >
              <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.6-1.81h3.45a1 1 0 00.95-.69l1.07-3.29z" />
            </svg>
          </button>
        ))}
      </div>
      {count != null && (
        <span className="text-[11px] text-zinc-400">({count})</span>
      )}
    </div>
  );
}
