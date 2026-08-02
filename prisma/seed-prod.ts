/**
 * Seed de PRODUÇÃO — cria apenas o essencial para a loja começar a operar:
 *  - o usuário administrador (senha vinda de ADMIN_PASSWORD, por segurança)
 *  - a tabela de frete fallback (usada se a API do Melhor Envio ficar fora)
 *
 * NÃO cria produtos, pedidos ou avaliações de exemplo — o catálogo real é
 * cadastrado pelo painel admin.
 *
 * Rodar (na 1ª publicação):
 *   ADMIN_EMAIL="voce@dominio.com" ADMIN_PASSWORD="senha-forte" npm run db:seed:prod
 *
 * É idempotente: pode rodar de novo sem apagar dados.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@usegatafit.com.br").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (password.length < 8) {
    console.error(
      "❌ Defina ADMIN_PASSWORD (mín. 8 caracteres, com letras e números) antes de rodar o seed de produção."
    );
    process.exit(1);
  }

  // ---- administrador (não sobrescreve se já existir) ----
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Administradora",
      email,
      passwordHash: bcrypt.hashSync(password, 12),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Admin: ${admin.email} (role ${admin.role})`);

  // ---- tabela de frete fallback (só cria se ainda não houver nenhuma) ----
  const existing = await prisma.shippingRule.count();
  if (existing === 0) {
    const regions = [
      { name: "São Paulo", start: "01000000", end: "19999999", pacBase: 1490, sedexBase: 2490, pacDays: 4, sedexDays: 1 },
      { name: "Sudeste (RJ/ES/MG)", start: "20000000", end: "39999999", pacBase: 1890, sedexBase: 2990, pacDays: 5, sedexDays: 2 },
      { name: "Nordeste", start: "40000000", end: "65999999", pacBase: 2590, sedexBase: 4290, pacDays: 9, sedexDays: 4 },
      { name: "Norte/Centro-Oeste", start: "66000000", end: "79999999", pacBase: 2890, sedexBase: 4890, pacDays: 10, sedexDays: 5 },
      { name: "Sul", start: "80000000", end: "99999999", pacBase: 1990, sedexBase: 3290, pacDays: 6, sedexDays: 2 },
    ];
    const bands = [
      { min: 0, max: 1000, extra: 0, label: "até 1kg" },
      { min: 1001, max: 5000, extra: 1000, label: "1–5kg" },
      { min: 5001, max: 30000, extra: 3000, label: "5–30kg" },
    ];
    for (const region of regions) {
      for (const band of bands) {
        await prisma.shippingRule.createMany({
          data: [
            {
              name: `${region.name} — PAC ${band.label}`,
              service: "PAC",
              cepStart: region.start,
              cepEnd: region.end,
              minWeightGrams: band.min,
              maxWeightGrams: band.max,
              priceCents: region.pacBase + band.extra,
              days: region.pacDays,
            },
            {
              name: `${region.name} — SEDEX ${band.label}`,
              service: "SEDEX",
              cepStart: region.start,
              cepEnd: region.end,
              minWeightGrams: band.min,
              maxWeightGrams: band.max,
              priceCents: region.sedexBase + Math.round(band.extra * 1.5),
              days: region.sedexDays,
            },
          ],
        });
      }
    }
    console.log("✅ Tabela de frete fallback criada (30 regras).");
  } else {
    console.log(`ℹ️  ${existing} regras de frete já existem — mantidas.`);
  }

  console.log("\n🎉 Seed de produção concluído. Cadastre os produtos pelo painel /admin.");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed de produção:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
