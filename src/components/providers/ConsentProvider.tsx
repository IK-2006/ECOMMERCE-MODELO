"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CONSENT_COOKIE } from "@/lib/tracking";

type Consent = "granted" | "denied" | null;

const ConsentContext = createContext<{
  consent: Consent;
  grant: () => void;
  deny: () => void;
}>({ consent: null, grant: () => {}, deny: () => {} });

export function useConsent() {
  return useContext(ConsentContext);
}

function readCookie(): Consent {
  const m = document.cookie.match(/(?:^|;\s*)cookie_consent=(granted|denied)/);
  return m ? (m[1] as Consent) : null;
}

function writeCookie(value: "granted" | "denied") {
  // 6 meses; lax é suficiente
  document.cookie = `${CONSENT_COOKIE}=${value};path=/;max-age=15552000;samesite=lax`;
}

/**
 * Guarda a decisão de consentimento de cookies (LGPD). O rastreamento
 * (Pixel/GA) só é carregado quando `consent === "granted"`.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    setConsent(readCookie());
  }, []);

  const grant = useCallback(() => {
    writeCookie("granted");
    setConsent("granted");
  }, []);

  const deny = useCallback(() => {
    writeCookie("denied");
    setConsent("denied");
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, grant, deny }}>
      {children}
    </ConsentContext.Provider>
  );
}
