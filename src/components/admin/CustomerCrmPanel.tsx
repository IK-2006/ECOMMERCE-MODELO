"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";

export function CustomerCrmPanel({
  userId,
  canEdit,
  initialTags,
  initialNotes,
}: {
  userId: string;
  canEdit: boolean;
  initialTags: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tags, setTags] = useState(initialTags);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Perfil de CRM salvo!");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">CRM</h2>

      {tagList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tagList.map((t) => (
            <Badge key={t} className="bg-accent-soft text-accent dark:bg-accent-soft-dark">{t}</Badge>
          ))}
        </div>
      )}

      {!canEdit ? (
        <p className="mt-3 text-sm text-zinc-500">{notes || "Sem observações."}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <Input
            label="Tags (separadas por vírgula)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vip, atacado, recorrente"
          />
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Observações internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Preferências, histórico de contato, combinados..."
              className="w-full rounded-none border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <Button loading={saving} onClick={save}>Salvar CRM</Button>
        </div>
      )}
    </div>
  );
}
