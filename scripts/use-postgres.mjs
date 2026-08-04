// Troca o provider do Prisma de sqlite → postgresql SOMENTE no build da
// nuvem (Vercel). Rodado pelo script "vercel-build" do package.json.
// O schema versionado continua em sqlite para o desenvolvimento local
// funcionar sem instalar nada. Este script edita apenas o build efêmero.
import { readFileSync, writeFileSync } from "node:fs";

const path = "prisma/schema.prisma";
const original = readFileSync(path, "utf8");

// Substitui APENAS o provider dentro do bloco `datasource db { ... }`
// (não toca em comentários nem no `provider` do generator).
const updated = original.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")sqlite("[^}]*?\})/,
  "$1postgresql$2",
);

if (updated !== original) {
  writeFileSync(path, updated);
  console.log("[use-postgres] datasource provider → postgresql (build de nuvem)");
} else {
  console.log("[use-postgres] provider já é postgresql — nada a fazer");
}
