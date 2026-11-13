import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ecopulse-theme";
const DEFAULT_THEME: Theme = "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Alterna `data-theme` en <html> y lo persiste en localStorage. El default
 * es "dark" para no cambiar el comportamiento actual de nadie que no haya
 * elegido "light" explícitamente (ver design-system/theme/theme.css).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage puede fallar en modo privado o con cookies bloqueadas;
      // se degrada al tema por defecto sin romper la app.
    }
    const initial: Theme = stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ver comentario de arriba.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
