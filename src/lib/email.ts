import nodemailer from "nodemailer";
import { formatCurrency, ORDER_STATUS_LABELS } from "@/lib/utils";

// ---------------------------------------------------------------
// E-mails transacionais. Sem SMTP_HOST no .env, os e-mails são
// apenas logados no console (modo dev) — nada quebra.
// ---------------------------------------------------------------

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function send(to: string, subject: string, html: string) {
  const transport = getTransport();
  if (!transport) {
    console.log(`\n[email:dev] Para: ${to}\n[email:dev] Assunto: ${subject}\n`);
    return;
  }
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "no-reply@localhost",
      to,
      subject,
      html,
    });
  } catch (err) {
    // E-mail nunca deve derrubar o fluxo principal (pedido, webhook...)
    console.error("[email] falha no envio:", err);
  }
}

const layout = (title: string, body: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 4px;font-size:20px">Gata Fit</h2>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:12px 0 20px"/>
  <h3 style="margin:0 0 12px;font-size:17px">${title}</h3>
  ${body}
  <p style="color:#71717a;font-size:12px;margin-top:28px">
    Este é um e-mail automático — não responda.
  </p>
</div>`;

export interface OrderEmailData {
  to: string;
  customerName: string;
  orderNumber: string;
  totalCents: number;
  items: Array<{ name: string; quantity: number; unitPriceCents: number }>;
}

export async function sendOrderConfirmation(data: OrderEmailData) {
  const rows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity}× ${i.name}</td>` +
        `<td style="padding:6px 0;text-align:right">${formatCurrency(i.unitPriceCents * i.quantity)}</td></tr>`
    )
    .join("");
  await send(
    data.to,
    `Pedido ${data.orderNumber} recebido 🎉`,
    layout(
      `Olá, ${data.customerName}! Recebemos seu pedido.`,
      `<p>Seu pedido <strong>${data.orderNumber}</strong> foi criado e está aguardando a confirmação do pagamento.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
         <tr><td style="padding:10px 0;border-top:1px solid #e4e4e7"><strong>Total</strong></td>
             <td style="padding:10px 0;border-top:1px solid #e4e4e7;text-align:right"><strong>${formatCurrency(data.totalCents)}</strong></td></tr>
       </table>
       <p>Você pode acompanhar o status em <a href="${process.env.NEXT_PUBLIC_APP_URL}/conta/pedidos">Minha Conta &rsaquo; Pedidos</a>.</p>`
    )
  );
}

export async function sendOrderStatusUpdate(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingCode?: string | null;
}) {
  const label = ORDER_STATUS_LABELS[params.status] ?? params.status;
  const tracking = params.trackingCode
    ? `<p>Código de rastreio: <strong>${params.trackingCode}</strong></p>`
    : "";
  await send(
    params.to,
    `Pedido ${params.orderNumber}: ${label}`,
    layout(
      `Olá, ${params.customerName}!`,
      `<p>O status do seu pedido <strong>${params.orderNumber}</strong> mudou para
       <strong>${label}</strong>.</p>${tracking}
       <p>Acompanhe em <a href="${process.env.NEXT_PUBLIC_APP_URL}/conta/pedidos">Minha Conta &rsaquo; Pedidos</a>.</p>`
    )
  );
}

const trackButton = (code?: string | null) =>
  code
    ? `<p style="margin:18px 0"><a href="https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(
        code,
      )}" style="background:#b07885;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Rastrear pedido</a></p>`
    : "";

/** "Pedido enviado" — etiqueta gerada, com rastreio e transportadora. */
export async function sendOrderShipped(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  company?: string | null;
  trackingCode?: string | null;
}) {
  const carrier = params.company
    ? `<p>Transportadora: <strong>${params.company}</strong></p>`
    : "";
  const tracking = params.trackingCode
    ? `<p>Código de rastreio: <strong>${params.trackingCode}</strong></p>`
    : "";
  await send(
    params.to,
    `Seu pedido ${params.orderNumber} foi enviado 🚚`,
    layout(
      `Oi, ${params.customerName}! Seu pedido está a caminho.`,
      `<p>Boas notícias: o pedido <strong>${params.orderNumber}</strong> já foi
       despachado e logo chega até você.</p>${carrier}${tracking}
       ${trackButton(params.trackingCode)}
       <p style="font-size:13px;color:#71717a">O rastreio pode levar algumas horas para
       apresentar a primeira movimentação. Você também acompanha tudo em
       <a href="${process.env.NEXT_PUBLIC_APP_URL}/conta/pedidos">Minha Conta &rsaquo; Pedidos</a>.</p>`,
    ),
  );
}

/** "Pedido entregue" — confirmado pelo rastreio. */
export async function sendOrderDelivered(params: {
  to: string;
  customerName: string;
  orderNumber: string;
}) {
  await send(
    params.to,
    `Seu pedido ${params.orderNumber} foi entregue 🎉`,
    layout(
      `Oi, ${params.customerName}! Seu pedido chegou.`,
      `<p>O pedido <strong>${params.orderNumber}</strong> foi <strong>entregue</strong>.
       Esperamos que você ame suas peças! 🥰</p>
       <p>Que tal deixar uma avaliação? Sua opinião ajuda muita gente a comprar com confiança.</p>
       <p style="margin-top:18px"><a href="${process.env.NEXT_PUBLIC_APP_URL}/conta/pedidos">Ver meus pedidos</a></p>`,
    ),
  );
}

export async function sendRefundRequestReceived(params: {
  to: string; // e-mail da loja
  orderNumber: string;
  customerName: string;
  reasonLabel: string;
}) {
  await send(
    params.to,
    `Nova solicitação de reembolso — ${params.orderNumber}`,
    layout(
      "Nova solicitação de reembolso",
      `<p><strong>${params.customerName}</strong> solicitou o reembolso do pedido
       <strong>${params.orderNumber}</strong>.</p>
       <p>Motivo: <strong>${params.reasonLabel}</strong></p>
       <p>Analise em <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/reembolsos">Painel &rsaquo; Reembolsos</a>.</p>`
    )
  );
}

export async function sendRefundStatusUpdate(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  statusLabel: string;
  adminNote?: string | null;
}) {
  const note = params.adminNote
    ? `<p style="background:#f4f4f5;padding:10px 14px;border-radius:8px">${params.adminNote}</p>`
    : "";
  await send(
    params.to,
    `Reembolso do pedido ${params.orderNumber}: ${params.statusLabel}`,
    layout(
      `Olá, ${params.customerName}!`,
      `<p>Sua solicitação de reembolso do pedido <strong>${params.orderNumber}</strong>
       foi atualizada para <strong>${params.statusLabel}</strong>.</p>${note}
       <p>Acompanhe em <a href="${process.env.NEXT_PUBLIC_APP_URL}/conta/pedidos">Minha Conta &rsaquo; Pedidos</a>.</p>`
    )
  );
}

export async function sendPasswordReset(to: string, name: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/redefinir-senha?token=${token}`;
  await send(
    to,
    "Recuperação de senha",
    layout(
      `Olá, ${name}!`,
      `<p>Recebemos um pedido para redefinir sua senha. O link vale por <strong>1 hora</strong>.</p>
       <p style="margin:20px 0"><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Redefinir senha</a></p>
       <p style="font-size:13px;color:#71717a">Se você não pediu isso, ignore este e-mail.</p>`
    )
  );
  if (!process.env.SMTP_HOST) {
    console.log(`[email:dev] Link de redefinição: ${url}`);
  }
}

/**
 * Convite de acesso ao painel: a conta é criada sem senha e o funcionário
 * define a sua pelo link (mesmo fluxo de "redefinir senha"). Link mais longo
 * (7 dias) porque é onboarding, não recuperação urgente.
 */
export async function sendUserInvite(params: {
  to: string;
  name: string;
  token: string;
  roleLabel: string;
}) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/redefinir-senha?token=${params.token}`;
  await send(
    params.to,
    "Você foi convidado para o painel da Gata Fit",
    layout(
      `Olá, ${params.name}!`,
      `<p>Uma conta de acesso ao painel foi criada para você com o perfil
       <strong>${params.roleLabel}</strong>. Defina sua senha para começar — o link
       vale por <strong>7 dias</strong>.</p>
       <p style="margin:20px 0"><a href="${url}" style="background:#b07885;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Definir minha senha</a></p>
       <p style="font-size:13px;color:#71717a">Se você não esperava este convite, ignore este e-mail.</p>`
    )
  );
  if (!process.env.SMTP_HOST) {
    console.log(`[email:dev] Link de convite (${params.roleLabel}): ${url}`);
  }
}

/** Há SMTP configurado (Brevo/outro)? */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Testa a conexão com o servidor SMTP (ex.: Brevo) sem enviar e-mail.
 * Surface erros de host/porta/credenciais logo na configuração.
 */
export async function verifyEmailTransport(): Promise<{ ok: boolean; message: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, message: "SMTP não configurado — defina SMTP_HOST/PORT/USER/PASS no ambiente." };
  }
  try {
    await transport.verify();
    return { ok: true, message: `Conexão SMTP OK (${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587}).` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Falha ao conectar no SMTP." };
  }
}

/** Envia um e-mail de teste para validar a configuração de envio. */
export async function sendTestEmail(to: string): Promise<void> {
  await send(
    to,
    "Teste de e-mail — Gata Fit ✅",
    layout(
      "E-mail configurado com sucesso!",
      `<p>Se você recebeu esta mensagem, o envio de e-mails da sua loja está
       <strong>funcionando</strong>. 🎉</p>
       <p style="font-size:13px;color:#71717a">Enviado via ${process.env.SMTP_HOST ?? "SMTP"} em
       ${new Date().toLocaleString("pt-BR")}.</p>`,
    ),
  );
}
