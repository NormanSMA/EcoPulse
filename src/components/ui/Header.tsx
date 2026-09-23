'use client';

import { useEffect, useRef, useState } from "react";
import { Activity, Sun, Moon, Languages, Search, Layers, Check, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Theme } from "@/design-system/hooks";
import { useLocale, type Locale } from "@/design-system/i18n/I18nProvider";
import { BASEMAP_ORDER, type Basemap } from "@/lib/mapStyles";
import { cn } from "@/design-system/utils/cn";

export type MapMode = "2d" | "3d";

interface HeaderProps {
  onSearchChange: (value: string) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  basemap: Basemap;
  onBasemapChange: (basemap: Basemap) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Selector segmentado 2D / 3D (segmented button Material 3). */
function ModeToggle({ mode, onChange, label }: { mode: MapMode; onChange: (m: MapMode) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-10 shrink-0 rounded-ds-full border border-ds-outline p-0.5">
      {(["2d", "3d"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            "grid min-w-[44px] place-items-center rounded-ds-full px-3 text-[13px] font-medium uppercase transition-colors duration-ds-fast",
            mode === m
              ? "bg-ds-secondary-container text-ds-secondary-on-container"
              : "text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/** Menú de mapa base (menu Material 3). Deshabilitado en 3D (Cesium usa su imagería). */
function BasemapMenu({ value, onChange, disabled }: { value: Basemap; onChange: (b: Basemap) => void; disabled: boolean }) {
  const t = useTranslations("basemap");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        aria-label={disabled ? t("unavailable3d") : t("title")}
        aria-haspopup="menu"
        aria-expanded={open}
        selected={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <MorphIcon icon={Layers} size={20} reducedMotion="user" />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 min-w-[200px] origin-top-right animate-ds-pop-in rounded-ds-xl border border-ds-outline-variant bg-ds-surface-container py-2 shadow-ds-3"
        >
          <p className="px-4 pb-1 pt-1 text-xs font-medium text-ds-text-secondary">{t("title")}</p>
          {BASEMAP_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm text-ds-text-primary transition-colors hover:bg-ds-hover"
            >
              <span className="w-5 shrink-0 text-ds-primary">
                {option === value && <MorphIcon icon={Check} size={18} reducedMotion="user" />}
              </span>
              {t(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header({
  onSearchChange,
  mapMode,
  onMapModeChange,
  basemap,
  onBasemapChange,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const tApp = useTranslations("app");
  const tSearch = useTranslations("search");
  const tTheme = useTranslations("theme");
  const tLang = useTranslations("language");
  const tMap = useTranslations("mapMode");
  const { locale, setLocale } = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  const [hasQuery, setHasQuery] = useState(false);

  function toggleLocale() {
    const next: Locale = locale === "es" ? "en" : "es";
    setLocale(next);
  }

  return (
    <header className="relative z-30 flex w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-ds-outline-variant bg-ds-canvas px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-x-3 sm:px-4 md:h-16 md:flex-nowrap md:py-0">
      {/* Marca: logo circular + nombre + tag "En vivo", como "Google Weather Lab · Experimental". */}
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-full border-2 border-ds-primary/60 text-ds-primary">
          <MorphIcon icon={Activity} size={20} strokeWidth={2.25} reducedMotion="user" />
        </span>
        <h1 className="hidden text-xl font-normal tracking-tight text-ds-text-primary min-[400px]:block">
          {tApp("title")}
        </h1>
        <span
          title={tApp("tagline")}
          className="hidden h-6 items-center rounded-ds-full border border-ds-outline px-2.5 text-xs font-medium text-ds-text-secondary sm:inline-flex"
        >
          {tApp("liveMonitor")}
        </span>
      </div>

      {/* Búsqueda: centrada en md+, fila completa desplegable en móvil. */}
      <div
        className={cn(
          "order-last w-full md:order-none md:mx-auto md:block md:w-auto md:max-w-xl md:flex-1",
          searchOpen ? "block" : "hidden"
        )}
      >
        <SearchInput placeholder={tSearch("placeholder")} shortcutHint={tSearch("shortcutHint")} onChange={(v) => {
            setHasQuery(v.trim() !== "");
            onSearchChange(v);
          }}
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-0">
        <IconButton
          aria-label={tSearch("toggle")}
          selected={searchOpen}
          onClick={() => setSearchOpen((o) => !o)}
          className="md:hidden"
        >
          <MorphIcon icon={searchOpen ? X : Search} size={20} reducedMotion="user" />
          {/* Filtro activo con la búsqueda plegada: sin esto la lista/mapa
              quedan filtrados sin ninguna pista visual en móvil. */}
          {!searchOpen && hasQuery && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ds-primary" aria-hidden="true" />
          )}
        </IconButton>

        <ModeToggle mode={mapMode} onChange={onMapModeChange} label={tMap("label")} />

        <span className="mx-1 hidden h-6 w-px bg-ds-outline-variant sm:block" aria-hidden="true" />

        <BasemapMenu value={basemap} onChange={onBasemapChange} disabled={mapMode === "3d"} />

        <IconButton aria-label={`${tLang("toggle")} (${locale.toUpperCase()})`} onClick={toggleLocale} className="relative">
          <MorphIcon icon={Languages} size={20} reducedMotion="user" />
          <span className="absolute bottom-1 right-0.5 rounded-sm bg-ds-canvas px-0.5 text-[9px] font-bold uppercase leading-none text-ds-text-primary">
            {locale}
          </span>
        </IconButton>

        <IconButton aria-label={theme === "dark" ? tTheme("toLight") : tTheme("toDark")} onClick={onToggleTheme}>
          <MorphIcon icon={theme === "dark" ? Sun : Moon} size={20} reducedMotion="user" />
        </IconButton>
      </div>
    </header>
  );
}
