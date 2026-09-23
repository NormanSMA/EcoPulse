'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

export type Locale = "es" | "en";

const MESSAGES: Record<Locale, typeof es> = { es, en };
const STORAGE_KEY = "ecopulse-locale";
const DEFAULT_LOCALE: Locale = "es";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

// Alternancia instantánea sin routing por URL (sin [locale] en la ruta) —
// el proyecto no necesita URLs localizadas, solo un selector en el Header.
export function I18nProvider({ children }: { children: ReactNode }) {
  // Se arranca siempre con el locale por defecto (igual que el HTML del
  // servidor) y el guardado se aplica tras montar: leer localStorage en el
  // render inicial provocaba un error de hidratación con idioma "en".
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") setLocaleState(stored);
    } catch {
      // localStorage puede fallar en modo privado; se queda el default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage puede fallar en modo privado; se degrada sin romper la app.
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale debe usarse dentro de <I18nProvider>");
  return ctx;
}
