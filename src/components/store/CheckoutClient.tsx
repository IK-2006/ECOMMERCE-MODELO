"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/providers/ToastProvider";
import { trackInitiateCheckout } from "@/lib/track-client";
import { formatCurrency, formatCep, cn, BR_STATES } from "@/lib/utils";

interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  phone: string | null;
  isDefault: boolean;
}

interface CartSummaryItem {
  id: string;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
}

interface Quote {
  carrier: string;
  service: string;
  serviceName: string;
  priceCents: number;
  days: number;
}

interface CouponInfo {
  code: string;
  discountCents: number;
  freeShipping: boolean;
}

interface PickupInfo {
  serviceName: string;
  days: number;
  address: string;
}

type DeliveryMode = "ENTREGA" | "RETIRADA";

const emptyAddress = {
  label: "Casa",
  recipient: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "SP",
  phone: "",
};

export function CheckoutClient({
  addresses,
  items,
  subtotalCents,
  pickup,
}: {
  addresses: SavedAddress[];
  items: CartSummaryItem[];
  subtotalCents: number;
  pickup: PickupInfo | null;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("ENTREGA");

  // Tráfego pago: evento InitiateCheckout ao abrir o checkout (uma vez).
  useEffect(() => {
    trackInitiateCheckout(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        priceReais: i.unitPriceCents / 100,
        quantity: i.quantity,
      })),
      subtotalCents / 100
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // etapa 1 — endereço
  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [addressId, setAddressId] = useState<string | null>(defaultAddr?.id ?? null);
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);
  const [saveAddress, setSaveAddress] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);

  // etapa 2 — frete
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [shippingService, setShippingService] = useState<string | null>(null);

  // etapa 3 — cupom + pagamento
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const activeCep = useNewAddress
    ? newAddress.cep
    : addresses.find((a) => a.id === addressId)?.cep ?? "";

  const maskCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  /** Preenche endereço automaticamente pelo CEP (ViaCEP). */
  const lookupCep = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNewAddress((a) => ({
          ...a,
          street: data.logradouro || a.street,
          district: data.bairro || a.district,
          city: data.localidade || a.city,
          state: data.uf || a.state,
        }));
      }
    } catch {
      // ViaCEP fora do ar não impede digitação manual
    } finally {
      setCepLoading(false);
    }
  };

  const validAddress = useNewAddress
    ? newAddress.recipient.trim().length >= 2 &&
      newAddress.cep.replace(/\D/g, "").length === 8 &&
      newAddress.street.trim() &&
      newAddress.number.trim() &&
      newAddress.district.trim() &&
      newAddress.city.trim()
    : !!addressId;

  const goToShipping = async () => {
    if (!validAddress) {
      toast("Preencha o endereço de entrega", "error");
      return;
    }
    setStep(2);
    setQuotesLoading(true);
    setShippingService(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: activeCep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuotes(data.quotes);
      const ship = (data.quotes as Quote[]).filter((q) => q.carrier !== "RETIRADA");
      if (ship.length > 0) setShippingService(ship[0].service);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao calcular frete", "error");
      setStep(1);
    } finally {
      setQuotesLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoupon(data);
      toast(`Cupom ${data.code} aplicado!`);
    } catch (err) {
      setCoupon(null);
      toast(err instanceof Error ? err.message : "Cupom inválido", "error");
    } finally {
      setCouponLoading(false);
    }
  };

  // frete só mostra transportadoras; a retirada é escolhida como método de entrega
  const shippingQuotes = quotes.filter((q) => q.carrier !== "RETIRADA");
  const pickupQuote: Quote | null = pickup
    ? {
        carrier: "RETIRADA",
        service: "retirada",
        serviceName: pickup.serviceName,
        priceCents: 0,
        days: pickup.days,
      }
    : null;
  const selectedQuote =
    deliveryMode === "RETIRADA"
      ? pickupQuote
      : shippingQuotes.find((q) => q.service === shippingService) ?? null;
  const shippingCents = coupon?.freeShipping ? 0 : selectedQuote?.priceCents ?? 0;
  const discountCents = coupon?.discountCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  const chooseDelivery = (mode: DeliveryMode) => {
    setDeliveryMode(mode);
    setStep(1);
    setShippingService(null);
    setQuotes([]);
  };

  const pay = async () => {
    if (!selectedQuote) {
      toast(
        deliveryMode === "RETIRADA" ? "Retirada indisponível" : "Selecione uma opção de frete",
        "error"
      );
      return;
    }
    const pickupMode = deliveryMode === "RETIRADA";
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: pickupMode || useNewAddress ? undefined : addressId,
          address:
            !pickupMode && useNewAddress
              ? { ...newAddress, cep: newAddress.cep.replace(/\D/g, "") }
              : undefined,
          saveAddress: !pickupMode && useNewAddress ? saveAddress : false,
          shippingService: selectedQuote.service,
          couponCode: coupon?.code ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar pedido");
      window.location.href = data.redirectUrl;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao processar pagamento", "error");
      setPaying(false);
    }
  };

  const steps = ["Entrega", deliveryMode === "RETIRADA" ? "Retirada" : "Frete", "Pagamento"];

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div>
        {/* indicador de etapas */}
        <ol className="flex items-center gap-3">
          {steps.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const current = step === n;
            return (
              <li key={label} className="flex flex-1 items-center gap-3">
                <button
                  onClick={() => done && setStep(n)}
                  disabled={!done}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center border text-xs font-medium transition-colors",
                    current && "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900",
                    done && "cursor-pointer border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100",
                    !current && !done && "border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600"
                  )}
                >
                  {done ? "✓" : n}
                </button>
                <span
                  className={cn(
                    "text-[11px] uppercase tracking-[0.14em]",
                    current ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-400"
                  )}
                >
                  {label}
                </span>
                {n < steps.length && <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />}
              </li>
            );
          })}
        </ol>

        {/* etapa 1: endereço */}
        {step === 1 && (
          <div className="animate-fade-in mt-10 space-y-4">
            {pickup && (
              <div>
                <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Como você quer receber?</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => chooseDelivery("ENTREGA")}
                    className={cn(
                      "border p-4 text-left text-sm transition-colors",
                      deliveryMode === "ENTREGA"
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                    )}
                  >
                    <span className="block font-medium">🏠 Receber em casa</span>
                    <span className="mt-0.5 block text-zinc-500">Entrega pelos Correios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseDelivery("RETIRADA")}
                    className={cn(
                      "border p-4 text-left text-sm transition-colors",
                      deliveryMode === "RETIRADA"
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                    )}
                  >
                    <span className="block font-medium">🏬 Retirar na loja</span>
                    <span className="mt-0.5 block text-zinc-500">Grátis · sem frete</span>
                  </button>
                </div>
              </div>
            )}

            {deliveryMode === "RETIRADA" ? (
              <div className="animate-fade-in border border-zinc-200 p-6 text-sm dark:border-zinc-800">
                <p className="font-medium">🏬 {pickup?.serviceName ?? "Retirar na loja"}</p>
                {pickup?.address && (
                  <p className="mt-2 whitespace-pre-line text-zinc-500">{pickup.address}</p>
                )}
                <p className="mt-2 text-zinc-500">
                  Fica pronto para retirada em até {pickup?.days ?? 1} dia
                  {(pickup?.days ?? 1) > 1 ? "s úteis" : " útil"} após a confirmação do pagamento.
                  Você será avisado quando puder buscar.
                </p>
              </div>
            ) : (
              <>
            <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Endereço de entrega</h2>

            {addresses.length > 0 && (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border p-4 transition-colors",
                      !useNewAddress && addressId === addr.id
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={!useNewAddress && addressId === addr.id}
                      onChange={() => {
                        setAddressId(addr.id);
                        setUseNewAddress(false);
                      }}
                      className="mt-1 accent-zinc-900 dark:accent-zinc-100"
                    />
                    <div className="text-sm">
                      <p className="font-medium">
                        {addr.label} — {addr.recipient}
                      </p>
                      <p className="mt-0.5 text-zinc-500">
                        {addr.street}, {addr.number}
                        {addr.complement ? ` – ${addr.complement}` : ""} · {addr.district}
                      </p>
                      <p className="text-zinc-500">
                        {addr.city}/{addr.state} · CEP {formatCep(addr.cep)}
                      </p>
                    </div>
                  </label>
                ))}

                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border p-4 text-sm transition-colors",
                    useNewAddress
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={useNewAddress}
                    onChange={() => setUseNewAddress(true)}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="font-medium">Usar outro endereço</span>
                </label>
              </div>
            )}

            {useNewAddress && (
              <div className="animate-fade-in grid gap-4 border border-zinc-200 p-6 dark:border-zinc-800 sm:grid-cols-2">
                <Input
                  label="Destinatário"
                  value={newAddress.recipient}
                  onChange={(e) => setNewAddress({ ...newAddress, recipient: e.target.value })}
                  placeholder="Nome de quem recebe"
                />
                <Input
                  label="CEP"
                  value={newAddress.cep}
                  onChange={(e) => {
                    const masked = maskCep(e.target.value);
                    setNewAddress({ ...newAddress, cep: masked });
                    lookupCep(masked);
                  }}
                  placeholder="00000-000"
                  inputMode="numeric"
                  hint={cepLoading ? "Buscando endereço..." : undefined}
                />
                <Input
                  label="Rua / Avenida"
                  value={newAddress.street}
                  onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                  className="sm:col-span-2"
                />
                <Input
                  label="Número"
                  value={newAddress.number}
                  onChange={(e) => setNewAddress({ ...newAddress, number: e.target.value })}
                />
                <Input
                  label="Complemento (opcional)"
                  value={newAddress.complement}
                  onChange={(e) => setNewAddress({ ...newAddress, complement: e.target.value })}
                />
                <Input
                  label="Bairro"
                  value={newAddress.district}
                  onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Cidade"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  />
                  <Select
                    label="UF"
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                  >
                    {BR_STATES.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Telefone (opcional)"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  Salvar este endereço para próximas compras
                </label>
              </div>
            )}
              </>
            )}

            {deliveryMode === "RETIRADA" ? (
              <Button size="lg" onClick={() => setStep(2)}>
                Continuar
              </Button>
            ) : (
              <Button size="lg" onClick={goToShipping} disabled={!validAddress}>
                Continuar para o frete
              </Button>
            )}
          </div>
        )}

        {/* etapa 2: frete */}
        {step === 2 && (
          <div className="animate-fade-in mt-10 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em]">
              {deliveryMode === "RETIRADA" ? (
                "Retirada na loja"
              ) : (
                <>
                  Opções de frete{" "}
                  <span className="ml-2 normal-case tracking-normal text-zinc-400">
                    CEP {formatCep(activeCep)}
                  </span>
                </>
              )}
            </h2>

            {deliveryMode === "RETIRADA" ? (
              <div className="border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                <p className="font-medium">🏬 {pickup?.serviceName ?? "Retirar na loja"}</p>
                {pickup?.address && (
                  <p className="mt-2 whitespace-pre-line text-zinc-500">{pickup.address}</p>
                )}
                <p className="mt-2 font-medium text-emerald-600">Grátis</p>
              </div>
            ) : quotesLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : shippingQuotes.length === 0 ? (
              <p className="border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                Nenhuma opção de entrega disponível para este CEP. Verifique o
                endereço ou tente novamente mais tarde.
              </p>
            ) : (
              <div className="space-y-2">
                {shippingQuotes.map((q) => (
                  <label
                    key={q.service}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border p-4 transition-colors",
                      shippingService === q.service
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingService === q.service}
                      onChange={() => setShippingService(q.service)}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    <div className="flex flex-1 items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{q.serviceName}</p>
                        <p className="text-zinc-500">
                          {q.carrier === "RETIRADA"
                            ? `pronto para retirada em até ${q.days} dia${q.days > 1 ? "s úteis" : " útil"}`
                            : `entrega em até ${q.days} dia${q.days > 1 ? "s" : ""} úteis`}
                        </p>
                      </div>
                      <span className="font-medium">
                        {q.priceCents === 0 || coupon?.freeShipping ? (
                          <span className="text-emerald-600">Grátis</span>
                        ) : (
                          formatCurrency(q.priceCents)
                        )}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button size="lg" onClick={() => setStep(3)} disabled={!selectedQuote}>
                Revisar e pagar
              </Button>
            </div>
          </div>
        )}

        {/* etapa 3: revisão + cupom + pagamento */}
        {step === 3 && (
          <div className="animate-fade-in mt-10 space-y-7">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Revisão do pedido</h2>

            <div className="border border-zinc-200 p-5 text-sm dark:border-zinc-800">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Entrega</p>
              {useNewAddress ? (
                <p className="mt-2 text-zinc-600 dark:text-zinc-300">
                  {newAddress.recipient} — {newAddress.street}, {newAddress.number} ·{" "}
                  {newAddress.city}/{newAddress.state} · CEP {formatCep(newAddress.cep)}
                </p>
              ) : (
                (() => {
                  const a = addresses.find((x) => x.id === addressId);
                  return a ? (
                    <p className="mt-2 text-zinc-600 dark:text-zinc-300">
                      {a.recipient} — {a.street}, {a.number} · {a.city}/{a.state} · CEP {formatCep(a.cep)}
                    </p>
                  ) : null;
                })()
              )}
              {selectedQuote && (
                <p className="mt-1 text-zinc-500">
                  {selectedQuote.carrier === "RETIRADA"
                    ? `${selectedQuote.serviceName} · pronto em até ${selectedQuote.days} dia${selectedQuote.days > 1 ? "s úteis" : " útil"}`
                    : `${selectedQuote.serviceName} · até ${selectedQuote.days} dia${selectedQuote.days > 1 ? "s úteis" : " útil"}`}
                </p>
              )}
            </div>

            {/* cupom */}
            <div>
              <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Cupom de desconto
              </p>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: BEMVINDO10"
                  className="uppercase"
                />
                <Button variant="outline" onClick={applyCoupon} loading={couponLoading}>
                  Aplicar
                </Button>
              </div>
              {coupon && (
                <p className="mt-2.5 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  ✓ Cupom <strong>{coupon.code}</strong> aplicado
                  {coupon.freeShipping
                    ? " — frete grátis"
                    : ` — ${formatCurrency(coupon.discountCents)} de desconto`}
                  <button
                    onClick={() => {
                      setCoupon(null);
                      setCouponCode("");
                    }}
                    className="text-xs text-zinc-400 underline underline-offset-2 hover:text-red-500"
                  >
                    remover
                  </button>
                </p>
              )}
            </div>

            <div className="bg-zinc-50 p-5 text-sm dark:bg-zinc-900">
              <p className="font-medium">Pagamento seguro via Mercado Pago</p>
              <p className="mt-1 text-zinc-500">
                Na próxima etapa você escolhe entre <strong>Pix</strong>,{" "}
                <strong>cartão de crédito em até 12×</strong> ou <strong>boleto</strong>.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button size="lg" onClick={pay} loading={paying} className="flex-1">
                Ir para o pagamento — {formatCurrency(totalCents)}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* resumo lateral */}
      <aside className="h-fit border border-zinc-200 p-7 dark:border-zinc-800 lg:sticky lg:top-32">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Seu pedido</h2>
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm">
              <div className="w-12 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="aspect-square size-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center">💎</div>
                )}
              </div>
              <div className="flex-1">
                <p className="line-clamp-1">{item.name}</p>
                <p className="text-[11px] tracking-wide text-zinc-400">
                  {item.variantName ? `${item.variantName} · ` : ""}
                  {item.quantity}×
                </p>
              </div>
              <span className="font-medium">
                {formatCurrency(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <hr className="my-5 border-zinc-200 dark:border-zinc-800" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{formatCurrency(subtotalCents)}</dd>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Desconto ({coupon?.code})</dt>
              <dd>−{formatCurrency(discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">
              {selectedQuote?.carrier === "RETIRADA" ? "Retirada" : "Frete"}
            </dt>
            <dd>
              {step < 2 || !selectedQuote
                ? "—"
                : coupon?.freeShipping || selectedQuote.priceCents === 0
                  ? "Grátis"
                  : formatCurrency(selectedQuote.priceCents)}
            </dd>
          </div>
        </dl>
        <hr className="my-5 border-zinc-200 dark:border-zinc-800" />
        <div className="flex justify-between text-base font-medium">
          <span>Total</span>
          <span>{formatCurrency(totalCents)}</span>
        </div>
        <Link
          href="/carrinho"
          className="mt-5 block text-center text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          Editar carrinho
        </Link>
      </aside>
    </div>
  );
}
