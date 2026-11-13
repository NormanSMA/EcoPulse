'use client';

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Languages, Search, Layers, Check, X, Bell, BellRing } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/Button";
import { CommandOmnibox, type OmniboxAction } from "@/components/ui/CommandOmnibox";
import AlertsPanel from "@/components/ui/AlertsPanel";
import { usePushAlerts } from "@/lib/usePushAlerts";
import { useMediaQuery } from "@/design-system/hooks";
import { useLocale, type Locale } from "@/design-system/i18n/I18nProvider";
import { BASEMAP_ORDER, type Basemap } from "@/lib/mapStyles";
import { cn } from "@/design-system/utils/cn";
import type { GlobalMode } from "@/lib/timeline";

export type MapMode = "2d" | "3d";

interface HeaderProps {
  mode: GlobalMode;
  offlineNote?: string;
  onSearch: (action: OmniboxAction) => void;
  /** Texto del filtro de radio activo (o null). */
  filterLabel?: string | null;
  onClearFilter?: () => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  basemap: Basemap;
  onBasemapChange: (basemap: Basemap) => void;
}

/** Selector segmentado 2D / 3D (segmented button Material 3). */
function ModeToggle({ mode, onChange, label }: { mode: MapMode; onChange: (m: MapMode) => void; label: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
        const index = radios.findIndex((radio) => radio === e.target);
        const next = radios[(index + (e.key === "ArrowRight" ? 1 : -1) + radios.length) % radios.length];
        next?.focus();
        next?.click();
      }}
      className="flex h-11 shrink-0 rounded-full border border-ds-control"
    >
      {(["2d", "3d"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          tabIndex={mode === m ? 0 : -1}
          onClick={() => onChange(m)}
          className={cn(
            "grid min-h-11 min-w-11 place-items-center rounded-full px-2 text-[13px] font-medium uppercase transition-colors duration-ds-fast active:bg-ds-press focus-visible:ring-2 focus-visible:ring-ds-primary disabled:pointer-events-none disabled:opacity-40",
            mode === m
              ? "bg-ds-primary-strong/25 text-white shadow-ds-glow"
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
function BasemapMenu({ value, onChange, disabled }: { value: Basemap; onChange: (b: Basemap) => void; disabled?: boolean }) {
  const t = useTranslations("basemap");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
        ref={triggerRef}
        aria-label={disabled ? t("unavailable3d") : t("title")}
        aria-haspopup="menu"
        aria-expanded={open}
        selected={open}
        disabled={disabled}
        className="h-11 w-11"
        onClick={() => setOpen((o) => !o)}
      >
        <MorphIcon icon={Layers} size={20} reducedMotion="user" />
      </IconButton>
      {open && (
        <div
          role="menu"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
            const index = items.findIndex((item) => item === event.target);
            items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
          className="ds-glass absolute right-0 top-12 z-50 min-w-[200px] origin-top-right animate-ds-pop-in rounded-ds-card py-2"
        >
          <p className="ds-eyebrow px-4 pb-1 pt-1">{t("title")}</p>
          {BASEMAP_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm text-ds-text-primary transition-colors hover:bg-ds-hover active:bg-ds-press focus-visible:bg-ds-hover"
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

/** Campana de alertas push: popover en escritorio, hoja inferior en móvil. */
function AlertsMenu({ locale }: { locale: Locale }) {
  const t = useTranslations("alerts");
  const tPanel = useTranslations("panel");
  const push = usePushAlerts(locale);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    (focusable()[0] ?? dialog)?.focus();
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node) && !dialog?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
      if (!mobile || e.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !dialog?.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last ?? dialog : first ?? dialog)?.focus();
      }
    }
    function onFocus(e: FocusEvent) {
      if (mobile && !dialog?.contains(e.target as Node)) (focusable()[0] ?? dialog)?.focus();
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      trigger?.focus();
    };
  }, [open, mobile]);

  const panel = (
    <>
      <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 animate-ds-fade-in bg-ds-scrim md:hidden" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={mobile || undefined}
        aria-label={t("title")}
        tabIndex={-1}
        className="ds-glass fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] animate-ds-sheet-in overflow-y-auto rounded-t-ds-sheet pb-[env(safe-area-inset-bottom)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-12 md:max-h-[80dvh] md:w-[340px] md:origin-top-right md:animate-ds-pop-in md:rounded-ds-card md:pb-0"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-ds-text-muted/50 md:hidden" />
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="ds-eyebrow">{t("title")}</p>
          <IconButton aria-label={tPanel("close")} onClick={() => setOpen(false)}>
            <MorphIcon icon={X} size={20} reducedMotion="user" />
          </IconButton>
        </div>
        <AlertsPanel push={push} />
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        ref={triggerRef}
        aria-label={t("title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        selected={open}
        className="h-11 w-11"
        onClick={() => setOpen((o) => !o)}
      >
        <MorphIcon icon={push.status === "on" ? BellRing : Bell} size={20} reducedMotion="user" />
      </IconButton>
      {open && (mobile ? createPortal(panel, document.body) : panel)}
    </div>
  );
}

export default function Header({
  mode,
  offlineNote,
  onSearch,
  filterLabel,
  onClearFilter,
  mapMode,
  onMapModeChange,
  basemap,
  onBasemapChange,
}: HeaderProps) {
  const tApp = useTranslations("app");
  const tSearch = useTranslations("search");
  const tLang = useTranslations("language");
  const tMap = useTranslations("mapMode");
  const tMode = useTranslations("mode");
  const { locale, setLocale } = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  const modeColor: Record<GlobalMode, string> = {
    live: "text-ds-status-live",
    history: "text-ds-primary",
    forecast: "text-ds-warning",
    offline: "text-ds-danger",
  };

  function toggleLocale() {
    const next: Locale = locale === "es" ? "en" : "es";
    setLocale(next);
  }

  return (
    <header className="pointer-events-none absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-30 flex justify-center">
      <div className="ds-glass pointer-events-auto relative flex h-14 w-full max-w-5xl items-center gap-2 rounded-full px-2 shadow-[var(--ds-glass-inset),var(--ds-shadow-2),0_0_32px_rgb(0_112_255_/_0.18)]">
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ds-primary/60 text-ds-primary shadow-ds-glow sm:h-9 sm:w-9">
            <MorphIcon icon={Activity} size={20} strokeWidth={2.25} reducedMotion="user" />
          </span>
          <h1 className="hidden text-sm font-normal tracking-tight text-ds-text-primary min-[431px]:block sm:text-xl">
            {tApp("title")}
          </h1>
        </div>

        <div className="min-w-11 flex-1 md:hidden">
          <IconButton
            aria-label={tSearch("toggle")}
            aria-expanded={searchOpen}
            aria-controls="header-omnibox"
            selected={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
            className="h-11 w-11"
          >
            <MorphIcon icon={searchOpen ? X : Search} size={20} reducedMotion="user" />
          </IconButton>
        </div>
        <div
          id="header-omnibox"
          className={cn(
            "ds-glass absolute inset-x-0 top-16 rounded-ds-card p-2 md:static md:block md:min-w-0 md:flex-1 md:rounded-none md:border-0 md:bg-transparent md:bg-none md:p-0 md:shadow-none md:backdrop-blur-none",
            searchOpen ? "block" : "hidden"
          )}
        >
          <CommandOmnibox
            locale={locale}
            focusWhen={searchOpen}
            filterLabel={filterLabel}
            onClearFilter={onClearFilter}
            onAction={(action) => {
              onSearch(action);
              setSearchOpen(false);
            }}
          />
        </div>

        <div className="flex shrink-0 items-center sm:gap-1">
          <span
            role="status"
            aria-description={mode === "offline" ? offlineNote : undefined}
            title={mode === "offline" ? offlineNote : undefined}
            className={cn("inline-flex items-center gap-2 rounded-full px-1 text-[11px] font-medium uppercase tracking-[0.12em] sm:bg-white/[0.04] sm:px-3 sm:py-2", modeColor[mode])}
          >
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full bg-current", mode === "live" && "animate-pulse motion-reduce:animate-none")} />
            <span className="sr-only sm:not-sr-only">{tMode(mode)}</span>
          </span>
          <ModeToggle mode={mapMode} onChange={onMapModeChange} label={tMap("label")} />

          <BasemapMenu value={basemap} onChange={onBasemapChange} />

          <IconButton aria-label={`${tLang("toggle")} (${locale.toUpperCase()})`} onClick={toggleLocale} className="relative h-11 w-11">
            <MorphIcon icon={Languages} size={20} reducedMotion="user" />
            <span className="absolute bottom-1 right-0.5 rounded-sm bg-ds-canvas px-0.5 text-[9px] font-bold uppercase leading-none text-ds-text-primary">
              {locale}
            </span>
          </IconButton>

          <AlertsMenu locale={locale} />
        </div>
      </div>
    </header>
  );
}
