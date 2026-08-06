import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { userCreateSchema } from "@/lib/validations";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { sendUserInvite } from "@/lib/email";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/** GET /api/admin/users — lista os usuários de equipe (staff). */
export const GET = handler(async () => {
  await requirePermission("users.manage");

  const users = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    // seleção EXPLÍCITA — nunca expõe passwordHash nem twoFactorSecret
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      twoFactorEnabled: true,
      passwordHash: true, // usado só para derivar "pendingInvite", não é retornado
      createdAt: true,
    },
  });

  const data = users.map(({ passwordHash, ...u }) => ({
    ...u,
    pendingInvite: passwordHash === null, // convidado que ainda não definiu a senha
  }));

  return NextResponse.json(data);
});

/** POST /api/admin/users — cria um usuário e envia o convite por e-mail. */
export const POST = handler(async (req) => {
  const actor = await requirePermission("users.manage");
  const body = userCreateSchema.parse(await req.json());

  // Escalonamento de privilégio: só um ADMIN pode criar outro ADMIN.
  if (body.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new ApiError(403, "Apenas um administrador pode criar outro administrador.");
  }

  // E-mail já em uso (constraint unique é o backstop; aqui é só a mensagem amigável).
  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) throw new ApiError(409, "Já existe uma conta com este e-mail.");

  const token = crypto.randomBytes(32).toString("hex");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: body.name, email: body.email, role: body.role, active: true },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    await tx.passwordResetToken.create({
      data: { token, userId: created.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
    return created;
  });

  void sendUserInvite({
    to: user.email,
    name: user.name,
    token,
    roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
  });

  await audit({
    userId: actor.id,
    action: "user.create",
    entity: "User",
    entityId: user.id,
    detail: { email: user.email, role: user.role, method: "invite" },
    ip: getClientIp(req),
  });

  return NextResponse.json({ ...user, pendingInvite: true }, { status: 201 });
});
