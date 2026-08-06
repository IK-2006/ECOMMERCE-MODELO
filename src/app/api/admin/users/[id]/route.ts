import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { userUpdateSchema } from "@/lib/validations";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { sendUserInvite } from "@/lib/email";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/** Bloqueia remover/desativar o ÚLTIMO administrador ativo. */
async function assertNotLastActiveAdmin(targetId: string) {
  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  if (activeAdmins <= 1) {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, active: true } });
    if (target?.role === "ADMIN" && target.active) {
      throw new ApiError(409, "Não é possível remover o único administrador ativo.");
    }
  }
}

/** PATCH /api/admin/users/[id] — edita nome, papel e/ou status. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission("users.manage");
  const { id } = await ctx.params;
  const body = userUpdateSchema.parse(await req.json());

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!target) throw new ApiError(404, "Usuário não encontrado");

  // Só um ADMIN gerencia outro ADMIN (evita um gerente rebaixar/editar admins).
  if (target.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new ApiError(403, "Apenas um administrador pode gerenciar outro administrador.");
  }

  const roleChanged = body.role !== undefined && body.role !== target.role;
  const activeChanged = body.active !== undefined && body.active !== target.active;

  // Escalonamento de privilégio: só um ADMIN concede o papel ADMIN.
  if (roleChanged && body.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new ApiError(403, "Apenas um administrador pode conceder o papel de administrador.");
  }

  // Anti-auto-sabotagem: não pode mudar o próprio papel nem se desativar.
  if (id === actor.id) {
    if (roleChanged) throw new ApiError(403, "Você não pode alterar o seu próprio papel.");
    if (body.active === false) throw new ApiError(403, "Você não pode desativar a sua própria conta.");
  }

  // Proteção do último administrador (rebaixar ou desativar).
  if ((roleChanged && body.role !== "ADMIN") || body.active === false) {
    await assertNotLastActiveAdmin(id);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  const ip = getClientIp(req);
  if (roleChanged) {
    await audit({ userId: actor.id, action: "user.role_change", entity: "User", entityId: id, detail: { from: target.role, to: updated.role }, ip });
  }
  if (activeChanged) {
    await audit({ userId: actor.id, action: updated.active ? "user.activate" : "user.deactivate", entity: "User", entityId: id, ip });
  }
  if (body.name !== undefined && body.name !== target.name) {
    await audit({ userId: actor.id, action: "user.update", entity: "User", entityId: id, detail: { name: updated.name }, ip });
  }

  return NextResponse.json(updated);
});

/** DELETE /api/admin/users/[id] — DESATIVA (nunca apaga: preserva histórico/FKs). */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission("users.manage");
  const { id } = await ctx.params;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, active: true, role: true } });
  if (!target) throw new ApiError(404, "Usuário não encontrado");

  if (target.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new ApiError(403, "Apenas um administrador pode gerenciar outro administrador.");
  }
  if (id === actor.id) throw new ApiError(403, "Você não pode desativar a sua própria conta.");
  await assertNotLastActiveAdmin(id);

  await prisma.user.update({ where: { id }, data: { active: false } });
  await audit({ userId: actor.id, action: "user.deactivate", entity: "User", entityId: id, ip: getClientIp(req) });

  return NextResponse.json({ ok: true, deactivated: true });
});

/** POST /api/admin/users/[id] — reenvia o convite (novo link de definição de senha). */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission("users.manage");
  const { id } = await ctx.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  if (!target) throw new ApiError(404, "Usuário não encontrado");
  if (target.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new ApiError(403, "Apenas um administrador pode gerenciar outro administrador.");
  }
  if (target.passwordHash) throw new ApiError(409, "Este usuário já definiu a senha.");

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { token, userId: target.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });

  void sendUserInvite({
    to: target.email,
    name: target.name,
    token,
    roleLabel: ROLE_LABELS[target.role as Role] ?? target.role,
  });

  await audit({ userId: actor.id, action: "user.invite_resent", entity: "User", entityId: id, ip: getClientIp(req) });

  return NextResponse.json({ ok: true });
});
