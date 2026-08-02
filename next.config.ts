import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as respostas.
const securityHeaders = [
  // impede MIME-sniffing (defesa contra XSS via arquivos servidos)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // clickjacking: a loja não deve ser embutida em iframes de terceiros
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS só tem efeito sob HTTPS (ignorado em http de dev)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // CSP mínima e segura (não quebra o Next): bloqueia embed, plugins e base-tag
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  images: {
    // Imagens servidas de /public sem otimização (evita dependência nativa do sharp em dev).
    // Ao migrar para S3/Cloudinary, remova esta flag e configure `remotePatterns`.
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // arquivos enviados: força download-safe e nunca interpreta como HTML/SVG ativo
      {
        source: "/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
