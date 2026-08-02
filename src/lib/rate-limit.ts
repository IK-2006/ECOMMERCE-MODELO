/**
 * Rate limiter em memória (janela deslizante) para rotas sensíveis
 * (login, cadastro, checkout, recuperação de senha).
 *
 * Em produção com múltiplas instâncias, troque por Redis/Upstash —
 * a interface `rateLimit()` permanece a mesma.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

// Limpeza periódica para não vazar memória
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * @param key      identificador único (ex.: `login:${ip}`)
 * @param limit    máximo de tentativas na janela
 * @param windowMs tamanho da janela em ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup(windowMs);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.timestamps.length, retryAfterSeconds: 0 };
}

/**
 * Extrai o IP real do cliente.
 *
 * IMPORTANTE (segurança): o `X-Forwarded-For` é uma LISTA
 * "cliente, proxy1, proxy2, ...". O valor da ESQUERDA é enviado pelo
 * cliente e pode ser FALSIFICADO para burlar rate limit. O nosso proxy
 * reverso (Caddy/Nginx) ANEXA o IP real observado à direita — por isso
 * lemos o último valor (após pular N proxies confiáveis).
 *
 * Configure TRUSTED_PROXY_HOPS com o número de proxies na frente da app
 * (padrão 1 = um Caddy/Nginx). Assim o cliente não consegue injetar um
 * IP falso à direita da cadeia.
 */
/**
 * Núcleo da extração de IP a partir do cabeçalho `X-Forwarded-For`.
 * Lê o valor ANEXADO pelo proxy confiável (à direita), nunca o da
 * esquerda (que o cliente pode falsificar). Usado tanto pelas rotas
 * (getClientIp) quanto pelo login (authorize) — mesma lógica, sem furos.
 */
export function clientIpFromForwardedFor(
  fwd: string | null | undefined,
  realIp?: string | null
): string {
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
      const idx = Math.max(0, parts.length - hops);
      return parts[idx];
    }
  }
  return realIp ?? "unknown";
}

export function getClientIp(req: Request): string {
  return clientIpFromForwardedFor(
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip")
  );
}
