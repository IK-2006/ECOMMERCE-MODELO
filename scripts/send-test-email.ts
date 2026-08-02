/**
 * Testa a configuração de e-mail (Brevo ou outro SMTP).
 *
 * Uso:
 *   npm run email:test -- voce@email.com
 *
 * Lê as variáveis SMTP_* do ambiente (ou do .env local). Primeiro verifica
 * a conexão com o servidor; se OK, envia um e-mail de teste ao destinatário.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

// carrega .env local (sem sobrescrever o que já vier do ambiente)
try {
  for (const line of readFileSync(path.resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {
  /* .env é opcional (em produção as vars vêm do host) */
}

async function main() {
  const to = process.argv[2];
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error("Uso: npm run email:test -- voce@email.com");
    process.exit(1);
  }

  const { verifyEmailTransport, sendTestEmail } = await import("@/lib/email");

  console.log("Verificando conexão SMTP...");
  const v = await verifyEmailTransport();
  console.log(v.ok ? `  ✓ ${v.message}` : `  ✗ ${v.message}`);
  if (!v.ok) {
    console.error("\nConfigure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM e tente de novo.");
    console.error("Brevo: host smtp-relay.brevo.com, porta 587, user = seu login, pass = SMTP key.");
    process.exit(1);
  }

  console.log(`Enviando e-mail de teste para ${to}...`);
  await sendTestEmail(to);
  console.log(`  ✓ Enviado. Confira a caixa de entrada de ${to} (e a pasta de spam).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});
