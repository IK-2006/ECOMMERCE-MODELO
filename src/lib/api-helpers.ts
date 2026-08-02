import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { AuthError } from "@/lib/session";

/**
 * Mapeia erros conhecidos do Prisma para respostas HTTP amigáveis,
 * evitando 500 genérico quando o input viola uma constraint
 * (FK inexistente, valor duplicado, registro não encontrado).
 */
function prismaErrorResponse(err: Prisma.PrismaClientKnownRequestError) {
  switch (err.code) {
    case "P2002": // violação de unique
      return NextResponse.json(
        { error: "Já existe um registro com esses dados" },
        { status: 409 }
      );
    case "P2003": // violação de foreign key
      return NextResponse.json(
        { error: "Referência inválida: registro relacionado não encontrado" },
        { status: 400 }
      );
    case "P2025": // registro não encontrado (update/delete)
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    default:
      return null;
  }
}

/**
 * Tratamento de erros centralizado para Route Handlers.
 * Uso:  export const POST = handler(async (req) => { ... });
 */
export function handler<T extends (req: Request, ctx: any) => Promise<Response>>(fn: T) {
  return async (req: Request, ctx: any): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // corpo malformado: `await req.json()` lança SyntaxError → 400 (não 500).
      // Evita erro interno + ruído no Sentry por requisição inválida do cliente.
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Requisição inválida (JSON malformado)" }, { status: 400 });
      }
      if (err instanceof ZodError) {
        const first = err.errors[0];
        return NextResponse.json(
          { error: first?.message ?? "Dados inválidos", issues: err.flatten().fieldErrors },
          { status: 400 }
        );
      }
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const res = prismaErrorResponse(err);
        if (res) return res;
      }
      // erro inesperado → monitoramento (Sentry, se configurado) + 500 genérico
      console.error("[api] erro não tratado:", err);
      Sentry.captureException(err);
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: `Muitas requisições. Tente novamente em ${retryAfterSeconds}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
