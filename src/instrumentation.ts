import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------
// Monitoramento de erros no SERVIDOR (Sentry).
//
// Ativado APENAS quando `SENTRY_DSN` existe no ambiente — sem DSN é
// no-op (zero impacto). Só servidor: o DSN NÃO vai para o bundle do
// cliente (sem prefixo NEXT_PUBLIC_), respeitando a política de segredos.
// Configure o DSN no serviço de hospedagem (não no código).
// ---------------------------------------------------------------

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
      // não coleta IP/headers/cookies do usuário por padrão (privacidade)
      sendDefaultPii: false,
    });
  }
}

// Encaminha erros de renderização/roteamento do App Router ao Sentry.
export const onRequestError = Sentry.captureRequestError;
