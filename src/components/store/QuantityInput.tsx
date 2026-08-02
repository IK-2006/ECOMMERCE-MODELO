"use client";

export function QuantityInput({
  value,
  onChange,
  max = 99,
  min = 1,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex h-12 items-center border border-zinc-300 dark:border-zinc-700">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        aria-label="Diminuir quantidade"
        className="flex h-full w-10 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium tabular-nums">{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
        className="flex h-full w-10 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        +
      </button>
    </div>
  );
}
