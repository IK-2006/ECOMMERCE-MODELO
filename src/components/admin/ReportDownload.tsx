"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ReportDownload({ endpoint = "sales" }: { endpoint?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(monthAgo);
  const [fim, setFim] = useState(today);

  const download = () => {
    const params = new URLSearchParams({ inicio, fim });
    window.open(`/api/admin/reports/${endpoint}?${params}`, "_blank");
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Input label="De" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </div>
      <div className="w-44">
        <Input label="Até" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <Button onClick={download}>⬇ Baixar CSV</Button>
      <Button variant="outline" onClick={() => window.print()}>
        🖨 Imprimir / PDF
      </Button>
    </div>
  );
}
