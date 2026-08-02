"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RatingStars } from "./RatingStars";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDate } from "@/lib/utils";

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  verified: boolean;
  createdAt: string;
  userName: string;
}

export function ReviewSection({
  productId,
  reviews,
  ratingAvg,
  ratingCount,
  alreadyReviewed,
}: {
  productId: string;
  reviews: ReviewView[];
  ratingAvg: number;
  ratingCount: number;
  alreadyReviewed: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, title, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar avaliação");
      toast("Avaliação enviada. Obrigado!");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao enviar avaliação", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-20 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Avaliações</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-serif text-4xl font-medium">{ratingAvg.toFixed(1)}</span>
            <div>
              <RatingStars value={ratingAvg} size="md" />
              <p className="mt-1 text-[11px] tracking-wide text-zinc-400">
                {ratingCount} avaliaç{ratingCount === 1 ? "ão" : "ões"}
              </p>
            </div>
          </div>
        </div>
        {!alreadyReviewed && (
          <Button
            variant="outline"
            onClick={() => {
              if (status !== "authenticated") {
                router.push(`/entrar?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                return;
              }
              setShowForm((v) => !v);
            }}
          >
            Avaliar produto
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="animate-slide-up mt-8 space-y-4 border border-zinc-200 p-6 dark:border-zinc-800"
        >
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Sua nota
            </p>
            <RatingStars value={rating} size="lg" onChange={setRating} />
          </div>
          <Input
            label="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Resumo da sua experiência"
          />
          <Textarea
            label="Comentário"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            minLength={5}
            maxLength={2000}
            placeholder="Conte o que achou da peça..."
          />
          <div className="flex gap-3">
            <Button type="submit" loading={sending}>Enviar avaliação</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="mt-8">
        {reviews.length === 0 && (
          <p className="text-sm text-zinc-400">
            Esta peça ainda não tem avaliações. Seja o primeiro a avaliar.
          </p>
        )}
        {reviews.map((review) => (
          <article
            key={review.id}
            className="border-t border-zinc-100 py-6 first:border-t-0 dark:border-zinc-800/60"
          >
            <div className="flex flex-wrap items-center gap-3">
              <RatingStars value={review.rating} />
              {review.title && <h3 className="text-sm font-medium">{review.title}</h3>}
              {review.verified && (
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                  ✓ Compra verificada
                </span>
              )}
            </div>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {review.comment}
            </p>
            <p className="mt-2.5 text-[11px] tracking-wide text-zinc-400">
              {review.userName} · {formatDate(review.createdAt)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
