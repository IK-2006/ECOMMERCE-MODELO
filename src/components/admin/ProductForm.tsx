"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/providers/ToastProvider";
import { slugify } from "@/lib/utils";
import { filterMoneyInput } from "@/lib/masks";

interface CategoryOption {
  id: string;
  name: string;
}

interface VariantForm {
  id?: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  barcode: string; // EAN/GTIN — leitura no PDV
  price: string; // em reais; vazio = usa preço do produto
  stock: number;
}

interface ImageForm {
  url: string;
  alt: string;
}

export interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAt: string;
  sku: string;
  barcode: string;
  brand: string;
  ncm: string;
  cest: string;
  origem: string;
  unidade: string;
  stock: number;
  minStock: number;
  active: boolean;
  featured: boolean;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  categoryId: string;
  images: ImageForm[];
  variants: VariantForm[];
}

const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);

export function ProductForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: ProductFormData;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!initial?.id;

  const [form, setForm] = useState<ProductFormData>(
    initial ?? {
      name: "",
      slug: "",
      description: "",
      price: "",
      compareAt: "",
      sku: "",
      barcode: "",
      brand: "",
      ncm: "",
      cest: "",
      origem: "0",
      unidade: "UN",
      stock: 0,
      minStock: 0,
      active: true,
      featured: false,
      weightGrams: 300,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      categoryId: categories[0]?.id ?? "",
      images: [],
      variants: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha no upload");
        setForm((f) => ({ ...f, images: [...f.images, { url: data.url, alt: f.name }] }));
      }
      toast("Imagem(ns) enviada(s)!");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro no upload", "error");
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    setForm((f) => {
      const images = [...f.images];
      const target = index + dir;
      if (target < 0 || target >= images.length) return f;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...f, images };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = toCents(form.price);
    if (!priceCents || priceCents <= 0) {
      toast("Informe um preço válido", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description,
        priceCents,
        compareAtCents: form.compareAt ? toCents(form.compareAt) : null,
        sku: form.sku,
        barcode: form.barcode,
        brand: form.brand,
        ncm: form.ncm,
        cest: form.cest,
        origem: form.origem,
        unidade: form.unidade,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        active: form.active,
        featured: form.featured,
        weightGrams: Number(form.weightGrams) || 300,
        lengthCm: Number(form.lengthCm) || 20,
        widthCm: Number(form.widthCm) || 15,
        heightCm: Number(form.heightCm) || 10,
        categoryId: form.categoryId,
        images: form.images,
        variants: form.variants.map((v) => ({
          id: v.id,
          name: v.name || [v.size, v.color].filter(Boolean).join(" / ") || "Padrão",
          size: v.size,
          color: v.color,
          sku: v.sku,
          barcode: v.barcode,
          priceCents: v.price ? toCents(v.price) : null,
          stock: Number(v.stock) || 0,
        })),
      };

      const res = await fetch(
        isEdit ? `/api/admin/products/${initial!.id}` : "/api/admin/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar produto");
      toast(isEdit ? "Produto atualizado!" : "Produto criado!");
      router.push("/admin/produtos");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    if (!confirm("Excluir este produto? Produtos já vendidos serão apenas desativados.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${initial!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.deactivated ? "Produto desativado (tinha vendas)" : "Produto excluído", "info");
      router.push("/admin/produtos");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao excluir", "error");
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* dados básicos */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 font-semibold">Dados básicos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="sm:col-span-2"
          />
          <Input
            label="Slug (URL)"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder={form.name ? slugify(form.name) : "gerado-automaticamente"}
            hint="Deixe vazio para gerar a partir do nome"
          />
          <Select
            label="Categoria *"
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input label="Marca" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) => set("sku", e.target.value)}
            placeholder="Gerado automaticamente"
            hint="Deixe em branco para gerar automático (ex.: GF-0001)."
          />
          <Input
            label="Código de barras (EAN/GTIN)"
            value={form.barcode}
            onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))}
            placeholder="Escaneie ou digite o código"
            inputMode="numeric"
            hint="Usado para leitura no PDV (Venda em Loja). Para produtos com variações, cadastre o código em cada variação."
          />
          <Textarea
            label="Descrição *"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            required
            minLength={10}
            className="min-h-36 sm:col-span-2"
          />
        </div>
      </section>

      {/* preço e estoque */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 font-semibold">Preço e estoque</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Preço (R$) *"
            value={form.price}
            onChange={(e) => set("price", filterMoneyInput(e.target.value))}
            placeholder="99,90"
            required
            inputMode="decimal"
          />
          <Input
            label="Preço &quot;de&quot; (R$)"
            value={form.compareAt}
            onChange={(e) => set("compareAt", filterMoneyInput(e.target.value))}
            placeholder="129,90"
            inputMode="decimal"
            hint="Preço riscado para mostrar desconto"
          />
          <Input
            label="Estoque (sem variações)"
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => set("stock", Number(e.target.value))}
            hint="Ignorado quando há variações"
          />
          <Input
            label="Estoque mínimo"
            type="number"
            min={0}
            value={form.minStock}
            onChange={(e) => set("minStock", Number(e.target.value))}
            hint="Dispara alerta de reposição quando o estoque atinge esse nível"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="accent-accent"
            />
            Produto ativo (visível na loja)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="accent-accent"
            />
            Destaque na página inicial
          </label>
        </div>
      </section>

      {/* fiscal */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 font-semibold">Fiscal (nota fiscal)</h2>
        <p className="mb-4 text-xs text-zinc-400">
          Usado na emissão de NFC-e/NF-e. Confirme o NCM e a origem com seu contador.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Input
            label="NCM"
            value={form.ncm}
            onChange={(e) => set("ncm", e.target.value.replace(/\D/g, ""))}
            placeholder="Ex.: 61046200"
            inputMode="numeric"
            hint="8 dígitos"
          />
          <Input
            label="CEST"
            value={form.cest}
            onChange={(e) => set("cest", e.target.value.replace(/\D/g, ""))}
            placeholder="Opcional (ICMS-ST)"
            inputMode="numeric"
          />
          <Select label="Origem" value={form.origem} onChange={(e) => set("origem", e.target.value)}>
            <option value="0">0 - Nacional</option>
            <option value="1">1 - Estrangeira (importação direta)</option>
            <option value="2">2 - Estrangeira (mercado interno)</option>
            <option value="3">3 - Nacional (import. &gt; 40%)</option>
            <option value="4">4 - Nacional (processos produtivos)</option>
            <option value="5">5 - Nacional (import. ≤ 40%)</option>
            <option value="6">6 - Estrangeira (import. direta, s/ similar)</option>
            <option value="7">7 - Estrangeira (mercado interno, s/ similar)</option>
            <option value="8">8 - Nacional (import. &gt; 70%)</option>
          </Select>
          <Input
            label="Unidade"
            value={form.unidade}
            onChange={(e) => set("unidade", e.target.value)}
            placeholder="UN"
          />
        </div>
      </section>

      {/* imagens */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 font-semibold">Imagens</h2>
        <p className="mb-4 text-xs text-zinc-400">
          JPG, PNG, WEBP ou GIF até 5 MB. A primeira imagem é a capa.
        </p>
        <label className="flex h-24 cursor-pointer items-center justify-center rounded-none border-2 border-dashed border-zinc-300 text-sm text-zinc-500 transition-colors hover:border-accent hover:text-accent dark:border-zinc-700">
          {uploading ? "Enviando..." : "📷 Clique para enviar imagens"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => uploadImages(e.target.files)}
            disabled={uploading}
          />
        </label>
        {form.images.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {form.images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="size-24 rounded-none border border-zinc-200 object-cover dark:border-zinc-700"
                />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                    CAPA
                  </span>
                )}
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    className="rounded bg-black/60 px-1.5 text-xs text-white"
                    aria-label="Mover para a esquerda"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))
                    }
                    className="rounded bg-red-600/90 px-1.5 text-xs text-white"
                    aria-label="Remover imagem"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    className="rounded bg-black/60 px-1.5 text-xs text-white"
                    aria-label="Mover para a direita"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* variações */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Variações (tamanho / cor)</h2>
            <p className="text-xs text-zinc-400">
              Com variações, o estoque é controlado por variação.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((f) => ({
                ...f,
                variants: [
                  ...f.variants,
                  { name: "", size: "", color: "", sku: "", barcode: "", price: "", stock: 0 },
                ],
              }))
            }
          >
            + Adicionar variação
          </Button>
        </div>

        {form.variants.length === 0 ? (
          <p className="text-sm text-zinc-400">Produto sem variações.</p>
        ) : (
          <div className="space-y-3">
            {form.variants.map((v, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-none border border-zinc-200 p-4 dark:border-zinc-700 sm:grid-cols-7"
              >
                <Input
                  label="Tamanho"
                  value={v.size}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, size: e.target.value };
                    set("variants", variants);
                  }}
                  placeholder="P, M, G, 38..."
                />
                <Input
                  label="Cor"
                  value={v.color}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, color: e.target.value };
                    set("variants", variants);
                  }}
                  placeholder="Preto, Azul..."
                />
                <Input
                  label="SKU"
                  value={v.sku}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, sku: e.target.value };
                    set("variants", variants);
                  }}
                  placeholder="Automático"
                />
                <Input
                  label="Cód. barras"
                  value={v.barcode}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, barcode: e.target.value.replace(/\D/g, "") };
                    set("variants", variants);
                  }}
                  placeholder="EAN/GTIN"
                  inputMode="numeric"
                />
                <Input
                  label="Preço (R$)"
                  value={v.price}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, price: filterMoneyInput(e.target.value) };
                    set("variants", variants);
                  }}
                  placeholder="herda"
                  inputMode="decimal"
                />
                <Input
                  label="Estoque"
                  type="number"
                  min={0}
                  value={v.stock}
                  onChange={(e) => {
                    const variants = [...form.variants];
                    variants[i] = { ...v, stock: Number(e.target.value) };
                    set("variants", variants);
                  }}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set("variants", form.variants.filter((_, j) => j !== i))
                    }
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* frete */}
      <section className="rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 font-semibold">Dimensões para frete</h2>
        <p className="mb-4 text-xs text-zinc-400">
          Usadas no cálculo de frete dos Correios (embalagem do produto).
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Input
            label="Peso (g)"
            type="number"
            min={1}
            value={form.weightGrams}
            onChange={(e) => set("weightGrams", Number(e.target.value))}
          />
          <Input
            label="Comprimento (cm)"
            type="number"
            min={1}
            value={form.lengthCm}
            onChange={(e) => set("lengthCm", Number(e.target.value))}
          />
          <Input
            label="Largura (cm)"
            type="number"
            min={1}
            value={form.widthCm}
            onChange={(e) => set("widthCm", Number(e.target.value))}
          />
          <Input
            label="Altura (cm)"
            type="number"
            min={1}
            value={form.heightCm}
            onChange={(e) => set("heightCm", Number(e.target.value))}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={saving}>
          {isEdit ? "Salvar alterações" : "Criar produto"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/produtos")}>
          Cancelar
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="danger"
            loading={deleting}
            onClick={remove}
            className="ml-auto"
          >
            Excluir produto
          </Button>
        )}
      </div>
    </form>
  );
}
