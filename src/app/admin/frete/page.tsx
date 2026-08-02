import { prisma } from "@/lib/prisma";
import { hasCorreiosCredentials, hasMelhorEnvioCredentials } from "@/services/shipping";
import { ShippingRuleManager } from "@/components/admin/ShippingRuleManager";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const rules = await prisma.shippingRule.findMany({
    orderBy: [{ service: "asc" }, { cepStart: "asc" }, { minWeightGrams: "asc" }],
  });
  const melhorEnvioActive = hasMelhorEnvioCredentials();
  const correiosActive = hasCorreiosCredentials();
  const externalActive = melhorEnvioActive || correiosActive;
  const providerName = melhorEnvioActive
    ? "Melhor Envio"
    : correiosActive
      ? "Correios (contrato CWS)"
      : null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Frete</h1>

      <div
        className={`mt-5 rounded-none border p-5 text-sm ${
          externalActive
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        }`}
      >
        {externalActive ? (
          <>
            <p className="font-semibold">✓ Cotação automática ativa via {providerName}</p>
            <p className="mt-1">
              O frete é calculado em tempo real
              {melhorEnvioActive ? " (Correios, Jadlog, Loggi e outras)" : " (PAC/SEDEX)"}.
              A tabela interna abaixo funciona como <strong>fallback automático</strong> caso
              a API fique fora do ar.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">⚠ Operando com a tabela de frete interna</p>
            <p className="mt-1">
              Nenhum provider externo está configurado no <code>.env</code>. O frete é
              calculado pelas regras abaixo — faixas de CEP, peso, preço e prazo. Preencha
              <code> MELHOR_ENVIO_TOKEN</code> (recomendado) ou as credenciais dos Correios
              para ativar a cotação automática.
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <ShippingRuleManager
          rules={rules.map((r) => ({
            id: r.id,
            name: r.name,
            service: r.service as "PAC" | "SEDEX",
            cepStart: r.cepStart,
            cepEnd: r.cepEnd,
            minWeightGrams: r.minWeightGrams,
            maxWeightGrams: r.maxWeightGrams,
            priceCents: r.priceCents,
            days: r.days,
            active: r.active,
          }))}
        />
      </div>
    </div>
  );
}
