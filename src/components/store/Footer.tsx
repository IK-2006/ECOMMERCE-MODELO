import Link from "next/link";
import { storeConfig } from "@/lib/store-config";

export function Footer() {
  const legalLine = [storeConfig.legalName, storeConfig.cnpj ? `CNPJ ${storeConfig.cnpj}` : "", storeConfig.legalAddress]
    .filter(Boolean)
    .join(" · ");

  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-xl font-medium uppercase tracking-[0.35em]">Gata Fit</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-zinc-400">
            Moda Feminina
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Moda fitness, praia e pijamas para mulheres que se cuidam. Peças com
            caimento perfeito que valorizam o seu corpo.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Institucional
          </h3>
          <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
            <li><Link href="/produtos" className="transition-colors hover:text-accent">Produtos</Link></li>
            <li><Link href="/conta/pedidos" className="transition-colors hover:text-accent">Meus pedidos</Link></li>
            <li><Link href="/favoritos" className="transition-colors hover:text-accent">Lista de desejos</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Ajuda &amp; Políticas
          </h3>
          <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
            <li><Link href="/trocas-e-devolucoes" className="transition-colors hover:text-accent">Trocas e devoluções</Link></li>
            <li><Link href="/politica-de-privacidade" className="transition-colors hover:text-accent">Política de privacidade</Link></li>
            <li><Link href="/termos-de-uso" className="transition-colors hover:text-accent">Termos de uso</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Atendimento
          </h3>
          <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              <a
                href={storeConfig.instagram}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-accent"
              >
                {storeConfig.instagramHandle}
              </a>
            </li>
            <li>
              <a href={`mailto:${storeConfig.contactEmail}`} className="transition-colors hover:text-accent">
                {storeConfig.contactEmail}
              </a>
            </li>
            <li>Seg. a sex., das 9h às 18h</li>
          </ul>
          <p className="mt-5 text-xs text-zinc-400">Pix · Cartão em até 12× · Boleto</p>
        </div>
      </div>
      <div className="border-t border-zinc-100 py-6 text-center text-[11px] leading-relaxed tracking-wide text-zinc-400 dark:border-zinc-900">
        © {new Date().getFullYear()} Gata Fit — Moda Feminina
        {legalLine && (
          <>
            <br />
            {legalLine}
          </>
        )}
      </div>
    </footer>
  );
}
