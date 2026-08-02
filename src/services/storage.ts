import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// ---------------------------------------------------------------
// Armazenamento de imagens.
//
// Dev: grava em /public/uploads (servido estaticamente pelo Next).
// Produção: troque a implementação de `saveImage` por S3/Cloudinary
// mantendo a mesma assinatura — o restante do código não muda.
//
// Segurança: o tipo do arquivo é validado pela ASSINATURA (magic bytes),
// não pelo Content-Type enviado pelo cliente (que é falsificável). SVG
// NÃO é aceito (pode conter script → XSS armazenado); apenas rasterizadas.
// ---------------------------------------------------------------

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export class UploadError extends Error {}

/** Detecta o tipo real da imagem pelos primeiros bytes (assinatura). */
function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (buf.length >= 6 && buf.toString("ascii", 0, 6).match(/^GIF8[79]a$/)) return "image/gif";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

/** Salva uma imagem enviada e retorna a URL pública (ex.: /uploads/abc.jpg). */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) throw new UploadError("Imagem acima de 5 MB.");
  if (file.size === 0) throw new UploadError("Arquivo vazio.");

  const buffer = Buffer.from(await file.arrayBuffer());

  // valida pelo conteúdo real, não pelo Content-Type informado
  const realType = detectImageType(buffer);
  const ext = realType ? EXT_BY_TYPE[realType] : null;
  if (!ext) {
    throw new UploadError("Arquivo inválido. Envie uma imagem JPG, PNG, WEBP ou GIF.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  // nome aleatório — nunca usar o nome original (path traversal / colisões)
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}
