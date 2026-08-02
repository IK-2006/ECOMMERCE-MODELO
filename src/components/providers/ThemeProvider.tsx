"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const THEME_COOKIE = "theme";

function readThemeCookie(): Theme | null {
  const m = document.cookie.match(/(?:^|;\s*)theme=(dark|light)/);
  return m ? (m[1] as Theme) : null;
}

function writeThemeCookie(theme: Theme) {
  // 1 ano; lax é suficiente (não é dado sensível)
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
}

/**
 * Dark mode persistido em COOKIE — o SSR (layout.tsx) lê o cookie e já
 * aplica a classe no <html>, sem script inline e sem flash de tema.
 * Na primeira visita (sem cookie), segue a preferência do sistema.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = readThemeCookie();
    if (stored) {
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial: Theme = prefersDark ? "dark" : "light";
      setTheme(initial);
      writeThemeCookie(initial); // fixa a escolha para os próximos SSRs
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      writeThemeCookie(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
