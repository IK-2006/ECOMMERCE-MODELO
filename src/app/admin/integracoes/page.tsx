import { requirePagePermission } from "@/lib/page-guard";
import { Badge } from "@/components/ui/Badge";
import { isMercadoPagoConfigured } from "@/services/payments/mercadopago";
import { hasCorreiosCredentials, hasMelhorEnvioCredentials } from "@/services/shipping";
import { isEmailConfigured } from "@/lib/email";
import { isFiscalConfigured } from "@/lib/fiscal-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrações" };

type Status = "connected" | "not_configured" | "planned";

interface Integration {
  name: string;
  category: string;
  status: Status;
  description: string;
  env?: string;
}

export default async function IntegrationsPage() {
  await requirePagePermission("settings.manage");

  const metaOn = Boolean(process.env.META_CAPI_ACCESS_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const whatsappOn = Boolean(process.env.WHATSAPP_API_URL);

  const integrations: Integration[] = [
    { name: "Mercado Pago", category: "Pagamentos", status: isMercadoPagoConfigured() ? "connected" : "not_configured", description: "Pagamento online (cartão, Pix, boleto) + webhook.", env: "MERCADOPAGO_ACCESS_TOKEN" },
    { name: "Melhor Envio", category: "Logística", status: hasMelhorEnvioCredentials() ? "connected" : "not_configured", description: "Cotação e emissão de etiquetas.", env: "MELHOR_ENVIO_TOKEN" },
    { name: "Correios (CWS)", category: "Logística", status: hasCorreiosCredentials() ? "connected" : "not_configured", description: "Cálculo de frete PAC/SEDEX por contrato.", env: "CORREIOS_*" },
    { name: "E-mail transacional", category: "Comunicação", status: isEmailConfigured() ? "connected" : "not_configured", description: "Confirmação de pedido, envio, entrega, convites.", env: "SMTP_HOST" },
    { name: "WhatsApp", category: "Comunicação", status: whatsappOn ? "connected" : "not_configured", description: "Avisos de pedido enviado/entregue.", env: "WHATSAPP_API_URL" },
    { name: "Meta CAPI", category: "Marketing", status: metaOn ? "connected" : "not_configured", description: "Eventos de compra server-side (tráfego pago).", env: "META_CAPI_ACCESS_TOKEN" },
    { name: "Emissor Fiscal (Focus NFe)", category: "Fiscal", status: isFiscalConfigured() ? "connected" : "not_configured", description: "Emissão de NFC-e / NF-e via provedor.", env: "FOCUS_NFE_TOKEN" },
    { name: "Mercado Livre", category: "Marketplace", status: "planned", description: "Sincronização de anúncios, estoque e pedidos.", env: "requer app OAuth do vendedor" },
    { name: "Shopee", category: "Marketplace", status: "planned", description: "Sincronização de catálogo e pedidos.", env: "requer app OAuth do vendedor" },
  ];

  const badge = (s: Status) => {
    if (s === "connected") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Conectado</Badge>;
    if (s === "not_configured") return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Não configurado</Badge>;
    return <Badge className="bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Planejado</Badge>;
  };

  const connected = integrations.filter((i) => i.status === "connected").length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {connected} de {integrations.length} integrações conectadas. Configure pelas variáveis de ambiente no servidor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((i) => (
          <div key={i.name} className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">{i.category}</p>
              </div>
              {badge(i.status)}
            </div>
            <p className="mt-2 text-sm text-zinc-500">{i.description}</p>
            {i.env && (
              <p className="mt-2 font-mono text-[11px] text-zinc-400">{i.env}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
