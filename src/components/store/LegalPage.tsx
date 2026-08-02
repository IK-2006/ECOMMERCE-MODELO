export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight">{title}</h1>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-400">
        Última atualização: {updatedAt}
      </p>
      <div className="legal mt-10 space-y-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {children}
      </div>
    </div>
  );
}

/** Título de seção padronizado para as páginas legais. */
export function LegalSection({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="pt-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-900 dark:text-zinc-100">
      {n}. {title}
    </h2>
  );
}
