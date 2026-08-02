import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      )}
    >
      {children}
    </span>
  );
}
