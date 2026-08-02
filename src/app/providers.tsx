"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { ConsentProvider } from "@/components/providers/ConsentProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ConsentProvider>
          <ToastProvider>
            <CartProvider>{children}</CartProvider>
          </ToastProvider>
        </ConsentProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
