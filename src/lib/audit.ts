import { prisma } from "@/lib/prisma";

/**
 * Registra uma ação administrativa no log de auditoria.
 * Nunca lança erro (auditoria não pode derrubar a operação principal).
 */
export async function audit(params: {
  userId?: string | null;
  action: string; // ex.: "product.create"
  entity: string; // ex.: "Product"
  entityId?: string | null;
  detail?: unknown;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        detail: params.detail != null ? JSON.stringify(params.detail).slice(0, 4000) : null,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao registrar log:", err);
  }
}
