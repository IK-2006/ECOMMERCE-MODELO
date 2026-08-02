"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useToast } from "./ToastProvider";

export interface CartItemView {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  variantName: string | null;
  unitPriceCents: number;
  imageUrl: string | null;
  stock: number;
}

export interface CartView {
  items: CartItemView[];
  subtotalCents: number;
  totalQuantity: number;
}

interface CartContextValue {
  cart: CartView | null;
  loading: boolean;
  addItem: (productId: string, variantId: string | null, quantity: number) => Promise<boolean>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
  cart: null,
  loading: true,
  addItem: async () => false,
  updateItem: async () => {},
  removeItem: async () => {},
  refresh: async () => {},
});

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.ok) setCart(await res.json());
    } catch {
      // silencioso — carrinho indisponível não deve quebrar a página
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: string, variantId: string | null, quantity: number) => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, quantity }),
      });
      if (res.ok) {
        setCart(await res.json());
        toast("Produto adicionado ao carrinho");
        return true;
      }
      const data = await res.json().catch(() => null);
      toast(data?.error ?? "Não foi possível adicionar", "error");
      return false;
    },
    [toast]
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity }),
      });
      if (res.ok) setCart(await res.json());
      else {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? "Não foi possível atualizar", "error");
      }
    },
    [toast]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await updateItem(itemId, 0);
    },
    [updateItem]
  );

  return (
    <CartContext.Provider value={{ cart, loading, addItem, updateItem, removeItem, refresh }}>
      {children}
    </CartContext.Provider>
  );
}
