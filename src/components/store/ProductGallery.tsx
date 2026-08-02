"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: Array<{ url: string; alt: string | null }>;
  name: string;
}) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-zinc-100 text-5xl text-zinc-300 dark:bg-zinc-900">
        ◇
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[selected].url}
          alt={images[selected].alt ?? name}
          className="aspect-square w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              aria-label={`Imagem ${i + 1}`}
              className={cn(
                "size-20 shrink-0 overflow-hidden border transition-all",
                i === selected
                  ? "border-zinc-900 dark:border-zinc-100"
                  : "border-transparent opacity-50 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
