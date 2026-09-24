'use client';

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X, MapPin } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import type { GeocodeResult } from "@/lib/pointInfo";

export interface PlaceSearchProps {
  locale: string;
  onPick: (place: GeocodeResult) => void;
  /** Enfoca el campo al pasar a true (buscador desplegable en móvil). */
  focusWhen?: boolean;
  className?: string;
}

/**
 * Buscador de lugares (como "Find locations" de Weather Lab): sugerencias de
 * Photon/OpenStreetMap con navegación por teclado (↑ ↓ Enter Esc) y atajo
 * Ctrl+K / Cmd+K. Al elegir un lugar el mapa vuela hasta él y abre su detalle.
 */
export function PlaceSearch({ locale, onPick, focusWhen, className }: PlaceSearchProps) {
  const t = useTranslations("placeSearch");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Al elegir un resultado el campo muestra su nombre: no hay que volver a buscarlo.
  const pickedRef = useRef<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (pickedRef.current === query) return;
    if (q.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&lang=${locale}`, { signal: controller.signal });
        const data: { results?: GeocodeResult[] } = res.ok ? await res.json() : {};
        setResults(data.results ?? []);
        setActive(0);
        setStatus("done");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setStatus("done");
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, locale]);

  useEffect(() => {
    if (focusWhen) inputRef.current?.focus();
  }, [focusWhen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && inputRef.current?.offsetParent !== null) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  function pick(r: GeocodeResult) {
    onPick(r);
    pickedRef.current = r.name;
    setQuery(r.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex h-11 items-center gap-3 rounded-ds-full bg-ds-surface-high px-4 text-sm text-ds-text-primary transition-[background-color,box-shadow] duration-ds-fast hover:bg-ds-surface-highest focus-within:bg-ds-surface-highest focus-within:ring-2 focus-within:ring-ds-primary">
        <MorphIcon icon={Search} size={18} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t("label")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          value={query}
          placeholder={t("placeholder")}
          onChange={(e) => {
            pickedRef.current = null;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ds-text-secondary [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-ds-full text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary"
          >
            <MorphIcon icon={X} size={16} reducedMotion="user" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-ds-md border border-ds-outline-variant px-1.5 py-0.5 font-sans text-[11px] text-ds-text-muted sm:inline-block">Ctrl+K</kbd>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-80 animate-ds-pop-in overflow-y-auto rounded-ds-xl border border-ds-outline-variant bg-ds-surface-container py-2 shadow-ds-3"
        >
          {status === "loading" && results.length === 0 && <li className="px-4 py-2 text-sm text-ds-text-secondary">{t("searching")}</li>}
          {status === "done" && results.length === 0 && <li className="px-4 py-2 text-sm text-ds-text-secondary">{t("noResults")}</li>}
          {results.map((r, i) => (
            <li
              key={`${r.name}-${r.lon}-${r.lat}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active && "bg-ds-hover")}
            >
              <MorphIcon icon={MapPin} size={18} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-ds-text-primary">{r.name}</span>
                {r.detail && <span className="block truncate text-xs text-ds-text-secondary">{r.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
