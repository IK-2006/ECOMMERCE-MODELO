import type { MetadataRoute } from "next";
import { storeConfig } from "@/lib/store-config";

export default function robots(): MetadataRoute.Robots {
  const base = storeConfig.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // áreas privadas / de sistema não devem ser indexadas
      disallow: ["/admin", "/conta", "/checkout", "/api", "/entrar", "/cadastro"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
