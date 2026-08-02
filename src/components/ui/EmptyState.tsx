export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-none border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      {icon && <div className="text-4xl">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
