'use client';

import { Activity, Radio, Flame, Sun, Moon, Globe } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { useFreshness, useTheme } from "@/design-system/hooks";
import { useLocale, type Locale } from "@/design-system/i18n/I18nProvider";

interface HeaderProps {
  earthquakeCount: number;
  maxMag: number;
  generatedAt?: number | null;
  onSearchChange: (value: string) => void;
}

export default function Header({ earthquakeCount, maxMag, generatedAt, onSearchChange }: HeaderProps) {
  const tApp = useTranslations("app");
  const tMetrics = useTranslations("metrics");
  const tSearch = useTranslations("search");
  const tTheme = useTranslations("theme");
  const status = useFreshness(generatedAt);
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();

  function toggleLocale() {
    const next: Locale = locale === "es" ? "en" : "es";
    setLocale(next);
  }

  return (
    <header className="w-full flex flex-wrap items-center gap-3 border-b border-ds-border bg-ds-surface px-4 py-2.5 z-10">
      <div className="flex items-center gap-3 shrink-0">
        {/* Marca (índigo) — el verde queda reservado para el estado "live" (StatusBadge). */}
        <div className="h-9 w-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
          <MorphIcon icon={Activity} size={20} reducedMotion="user" />
        </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-ds-text-primary">{tApp("title")}</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {tApp("liveMonitor")}
            </span>
          </div>
          <p className="text-xs text-ds-text-secondary">{tApp("tagline")}</p>
        </div>
      </div>

      <div className="flex-1 min-w-[180px] max-w-md">
        <SearchInput
          placeholder={tSearch("placeholder")}
          shortcutHint={tSearch("shortcutHint")}
          onChange={onSearchChange}
        />
      </div>

      <div className="flex items-center gap-4 text-xs shrink-0 ml-auto">
        <div className="flex items-center gap-2">
          <MorphIcon icon={Radio} size={16} reducedMotion="user" className="text-rose-500" />
          <MetricCard
            label={tMetrics("earthquakes24h")}
            value={earthquakeCount}
            status={generatedAt != null ? status : undefined}
          />
        </div>
        <div className="h-4 w-px bg-ds-border" />
        <div className="flex items-center gap-2">
          <MorphIcon icon={Flame} size={16} reducedMotion="user" className="text-amber-500" />
          <MetricCard label={tMetrics("maxMagnitude")} value={`M ${maxMag.toFixed(1)}`} />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="quiet"
          size="sm"
          onClick={toggleLocale}
          aria-label="Toggle language"
          className="!p-2.5 !bg-ds-surface !text-ds-text-primary border border-ds-border hover:!bg-ds-surface-elevated"
        >
          <MorphIcon icon={Globe} size={16} reducedMotion="user" />
          <span className="uppercase text-[10px] font-bold">{locale}</span>
        </Button>

        <Button
          variant="quiet"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? tTheme("toLight") : tTheme("toDark")}
          className="!p-2.5 !bg-ds-surface !text-ds-text-primary border border-ds-border hover:!bg-ds-surface-elevated"
        >
          <MorphIcon icon={theme === "dark" ? Sun : Moon} size={16} reducedMotion="user" />
        </Button>
      </div>
    </header>
  );
}
