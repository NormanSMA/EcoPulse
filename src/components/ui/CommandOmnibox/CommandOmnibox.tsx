'use client';

import { useEffect, useId, useMemo, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { Search, X, MapPin, LocateFixed } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { formatCoords } from "@/lib/format";
import { parseOmniQuery } from "@/lib/omniQuery";
import { normalizeText, searchPlaces } from "@/lib/placeIndex";
import type { GeocodeResult } from "@/lib/pointInfo";

export type OmniboxAction =
  | { type: "place"; place: GeocodeResult; radiusKm?: number }
  | { type: "here"; at: [lon: number, lat: number]; radiusKm: number };

export interface CommandOmniboxProps {
  locale: string;
  onAction: (action: OmniboxAction) => void;
  focusWhen?: boolean;
  filterLabel?: string | null;
  onClearFilter?: () => void;
  className?: string;
}

type Status = "idle" | "loading" | "done" | "error" | "locating" | "geoDenied" | "geoNotSupported";
type Option =
  | { kind: "place"; place: GeocodeResult; local: boolean }
  | { kind: "here"; radiusKm: number };

export function CommandOmnibox({
  locale, onAction, focusWhen, filterLabel, onClearFilter, className,
}: CommandOmniboxProps): JSX.Element {
  const t = useTranslations("omnibox");
  const [{ query, results, status, open, active }, setState] = useState({
    query: "",
    results: [] as GeocodeResult[],
    status: "idle" as Status,
    open: false,
    active: 0,
  });
  const parsed = useMemo(() => parseOmniQuery(query), [query]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const locationRequestRef = useRef(0);
  const listId = useId();
  const options = useMemo<Option[]>(() => {
    if (parsed.kind === "coords") {
      return [{
        kind: "place",
        local: false,
        place: {
          name: formatCoords(parsed.lon, parsed.lat),
          detail: "",
          lon: parsed.lon,
          lat: parsed.lat,
          kind: "coords",
        },
      }];
    }
    if (parsed.kind === "here") return [{ kind: "here", radiusKm: parsed.radiusKm }];
    if (parsed.kind !== "place") return [];
    const local = searchPlaces(parsed.text, 3);
    const localNames = new Set(local.map((place) => normalizeText(place.name)));
    return [
      ...local.map((place): Option => ({ kind: "place", place, local: true })),
      ...results
        .filter((place) => !localNames.has(normalizeText(place.name)))
        .map((place): Option => ({ kind: "place", place, local: false })),
    ];
  }, [parsed, results]);

  useEffect(() => {
    if (pickedRef.current === query) return;
    if (parsed.kind !== "place" || parsed.text.length < 2) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((state) => ({ ...state, results: [], status: "loading", active: 0 }));
    const handle = setTimeout(async () => {
      if (controller.signal.aborted) return;
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(parsed.text)}&lang=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Geocode request failed");
        const data: { results?: GeocodeResult[] } = await res.json();
        if (controller.signal.aborted) return;
        setState((state) => ({ ...state, results: data.results ?? [], status: "done" }));
      } catch (err) {
        if (!controller.signal.aborted && !(err instanceof DOMException && err.name === "AbortError")) {
          setState((state) => ({ ...state, results: [], status: "error" }));
        }
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, parsed, locale]);

  useEffect(() => {
    if (focusWhen) inputRef.current?.focus();
  }, [focusWhen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const input = inputRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && input && input.offsetParent !== null) {
        e.preventDefault();
        input.focus();
      }
    }
    function onDown(e: PointerEvent) {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) {
        setState((state) => ({ ...state, open: false }));
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      locationRequestRef.current += 1;
    };
  }, []);

  function changeQuery(value: string) {
    controllerRef.current?.abort();
    locationRequestRef.current += 1;
    pickedRef.current = null;
    setState({ query: value, results: [], status: "idle", open: true, active: 0 });
  }

  function finishPick(name: string, action: OmniboxAction) {
    const value = action.radiusKm === undefined ? name : `${name} @${action.radiusKm}km`;
    controllerRef.current?.abort();
    pickedRef.current = value;
    setState({ query: value, results: [], status: "idle", open: false, active: 0 });
    inputRef.current?.blur();
    onAction(action);
  }

  function pick(option: Option) {
    if (status === "locating") return;
    if (option.kind === "place") {
      const radiusKm = parsed.kind === "place" || parsed.kind === "coords" ? parsed.radiusKm : undefined;
      finishPick(option.place.name, { type: "place", place: option.place, radiusKm });
      return;
    }
    if (!navigator.geolocation) {
      setState((state) => ({ ...state, status: "geoNotSupported" }));
      return;
    }
    const request = ++locationRequestRef.current;
    setState((state) => ({ ...state, status: "locating" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locationRequestRef.current !== request) return;
        finishPick(t("nearMe", { km: option.radiusKm }), {
          type: "here",
          at: [position.coords.longitude, position.coords.latitude],
          radiusKm: option.radiusKm,
        });
      },
      () => {
        if (locationRequestRef.current !== request) return;
        setState((state) => ({ ...state, status: "geoDenied" }));
      },
    );
  }

  function optionLabel(option: Option): string {
    if (option.kind === "here") return t("nearMe", { km: option.radiusKm });
    const place = option.place.kind === "coords"
      ? t("goToCoords", { coords: option.place.name })
      : option.place.name;
    return (parsed.kind === "place" || parsed.kind === "coords") && parsed.radiusKm !== undefined
      ? t("withRadius", { place, km: parsed.radiusKm })
      : place;
  }

  const locating = status === "locating";
  const hint = query.trim() === "";
  const showPanel = open && (hint || options.length > 0 || status !== "idle");
  const showList = showPanel && options.length > 0;
  const statusMessage = {
    idle: "",
    loading: t("searching"),
    done: options.length === 0 ? t("noResults") : t("resultsFound", { count: options.length }),
    error: t("error"),
    locating: t("locating"),
    geoDenied: t("geoDenied"),
    geoNotSupported: t("geoNotSupported"),
  }[status];

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setState((state) => ({ ...state, open: false }));
        }
      }}
    >
      <div className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-ds-control bg-white/[0.04] px-3 text-sm text-ds-text-primary hover:bg-ds-hover focus-within:border-ds-primary focus-within:shadow-ds-glow focus-within:ring-2 focus-within:ring-ds-primary">
        <MorphIcon icon={Search} size={18} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t("label")}
          aria-expanded={showPanel}
          aria-controls={showPanel ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
          aria-busy={locating || status === "loading"}
          value={query}
          placeholder={t("placeholder")}
          onChange={(e) => changeQuery(e.target.value)}
          onFocus={() => setState((state) => ({ ...state, open: true }))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : -1;
              setState((state) => ({
                ...state,
                open: true,
                active: state.open ? Math.max(0, Math.min(state.active + step, options.length - 1)) : 0,
              }));
            } else if (e.key === "Enter" && showList && options[active]) {
              e.preventDefault();
              pick(options[active]);
            } else if (e.key === "Escape") {
              setState((state) => ({ ...state, open: false }));
              inputRef.current?.blur();
            }
          }}
          className="h-11 w-0 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ds-text-secondary focus-visible:rounded-ds-md active:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden"
        />
        {filterLabel != null && (
          <span className="flex h-8 min-w-0 max-w-32 items-center rounded-ds-full bg-ds-secondary-container pl-2 text-xs text-ds-secondary-on-container">
            <span className="min-w-0 truncate">{filterLabel}</span>
            <button
              type="button"
              aria-label={t("clearFilter")}
              disabled={!onClearFilter}
              onClick={onClearFilter}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-full hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary active:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MorphIcon icon={X} size={14} reducedMotion="user" />
            </button>
          </span>
        )}
        {query ? (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => {
              changeQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-ds-full text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary active:bg-ds-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MorphIcon icon={X} size={16} reducedMotion="user" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-ds-md border border-ds-outline-variant px-1.5 py-0.5 font-sans text-xs text-ds-text-muted sm:inline-block">Ctrl+K</kbd>
        )}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {showPanel ? statusMessage : ""}
      </div>
      {showPanel && (
        <div className="ds-glass absolute left-0 right-0 top-12 z-50 max-h-80 overflow-y-auto rounded-ds-card py-2">
          {hint && <p className="px-4 py-2 text-sm text-ds-text-secondary">{t("hint")}</p>}
          {statusMessage && status !== "done" && (
            <p className="px-4 py-2 text-sm text-ds-text-secondary">{statusMessage}</p>
          )}
          {status === "done" && options.length === 0 && (
            <p className="px-4 py-2 text-sm text-ds-text-secondary">{statusMessage}</p>
          )}
          <ul id={listId} role="listbox" aria-label={t("label")}>
            {options.map((option, i) => (
              <li
                key={option.kind === "here" ? "here" : `${option.place.name}-${option.place.lon}-${option.place.lat}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={locating}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setState((state) => ({ ...state, active: i }))}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-primary active:bg-ds-hover aria-disabled:cursor-wait aria-disabled:opacity-50",
                  i === active && "bg-ds-hover",
                )}
              >
                <MorphIcon icon={option.kind === "here" ? LocateFixed : MapPin} size={18} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ds-text-primary">{optionLabel(option)}</span>
                  {option.kind === "place" && option.place.detail && (
                    <span className="block truncate text-xs text-ds-text-secondary">{option.place.detail}</span>
                  )}
                </span>
                {option.kind === "place" && option.local && (
                  <span className="shrink-0 text-xs text-ds-text-secondary">{t("suggestion")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
