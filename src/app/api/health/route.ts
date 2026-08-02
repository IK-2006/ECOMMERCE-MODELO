import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — checagem de disponibilidade para monitores de uptime
 * (UptimeRobot, etc.). Verifica o processo e a conexão com o banco.
 * Resposta mínima, sem expor dados internos:
 *   200 { status: "ok" }        — tudo no ar
 *   503 { status: "degraded" }  — banco inacessível
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "degraded" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
