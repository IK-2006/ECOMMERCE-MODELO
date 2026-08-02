"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const ToastContext = createContext<{
  toast: (message: string, type?: Toast["type"]) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "animate-slide-up pointer-events-auto rounded-none px-4 py-3 text-sm font-medium shadow-lg ring-1",
              t.type === "success" &&
                "bg-white text-emerald-700 ring-emerald-200 dark:bg-zinc-900 dark:text-emerald-400 dark:ring-emerald-900",
              t.type === "error" &&
                "bg-white text-red-700 ring-red-200 dark:bg-zinc-900 dark:text-red-400 dark:ring-red-900",
              t.type === "info" &&
                "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
