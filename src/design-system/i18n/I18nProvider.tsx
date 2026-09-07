'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "en" || stored === "es" ? stored : DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

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
