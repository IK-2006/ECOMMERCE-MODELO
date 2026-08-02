"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/providers/ConsentProvider";
import { trackingConfig } from "@/lib/tracking";
import { markTrackingReady } from "@/lib/track-client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Injeta Meta Pixel + Google Analytics 4 — SOMENTE após o consentimento
 * (LGPD). A injeção é imperativa (não renderiza <script> no React),
 * evitando avisos e dando controle total. Dispara PageView a cada
 * navegação (SPA). O evento de COMPRA é server-side (CAPI), não aqui.
 */
export function Analytics() {
  const { consent } = useConsent();
  const pathname = usePathname();
  const loaded = useRef(false);

  useEffect(() => {
    if (consent !== "granted") return;
    const w = window as any;
    const { metaPixelId, ga4Id } = trackingConfig;

    // ---- Meta Pixel (carrega uma vez) ----
    if (metaPixelId && !w.fbq) {
      (function (f: any, b: any, e: string, v: string) {
        const n: any = (f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        const t = b.createElement(e);
        t.async = true;
        t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(w, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      w.fbq("init", metaPixelId);
    }

    // ---- Google Analytics 4 (carrega uma vez) ----
    if (ga4Id && !w.gtag) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
      document.head.appendChild(s);
      w.dataLayer = w.dataLayer || [];
      w.gtag = function () {
        w.dataLayer.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", ga4Id, { send_page_view: false });
    }

    loaded.current = true;
    // libera os eventos que foram bufferizados antes do pixel carregar
    markTrackingReady();
  }, [consent]);

  // PageView a cada mudança de rota (após carregado)
  useEffect(() => {
    if (consent !== "granted" || !loaded.current) return;
    const w = window as any;
    w.fbq?.("track", "PageView");
    if (trackingConfig.ga4Id) w.gtag?.("event", "page_view", { page_path: pathname });
  }, [pathname, consent]);

  return null;
}
