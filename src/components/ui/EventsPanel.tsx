'use client';

import { useEffect, useMemo, useState, type KeyboardEvent, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Waves, Flame, AlertTriangle, Mountain, Tornado, Search, Inbox, Radio, Activity, Siren } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { layers, marker, magnitudeColor, alertColor, stormColor } from "@/design-system/tokens";
import { relativeTime } from "@/lib/format";
import { selectionKey, type Selection } from "@/lib/selection";
import type { MapData, LayerVisibility } from "@/components/map/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatStrip } from "@/components/ui/MetricCard";

type EventKind = "quake" | "fire" | "disaster" | "cyclone" | "volcano";

export interface EventItem {
  key: string;
  kind: EventKind;
  selection: Selection;
  coords: [number, number];
  title: string;
  subtitle: string;
  time: number | null;
  /** Importancia para el orden "Importantes" (mayor = más arriba). */
  score: number;
  color: string;
  icon: IconNode;
  mag?: number;
  depth?: number;
  tsunami?: boolean;
  badge?: string;
}

const ICONS: Record<EventKind, IconNode> = { quake: Waves, fire: Flame, disaster: AlertTriangle, cyclone: Tornado, volcano: Mountain };
const PAGE = 30;
const DISASTER_TYPES = ["FL", "TC", "DR", "VO"] as const;
const ALERT_LEVELS = ["Green", "Orange", "Red"] as const;
const STORM_CATEGORIES = ["TD", "TS", "HU"] as const;
const ALERT_SCORE = { Green: 25, Orange: 45, Red: 65 } as const;
const PAGER_SCORE = { green: 5, yellow: 20, orange: 35, red: 50 } as const;

/**
 * Construye la lista unificada de eventos. La importancia pondera
 * magnitud, alertas oficiales (PAGER, GDACS, tsunami) y recencia, para que
 * los miles de focos de incendio no tapen un sismo fuerte o un ciclón.
 */
export interface EventLabels {
  disasterTypes?: Record<string, string>;
  alertLevels?: Record<string, string>;
  stormCategories?: Record<string, string>;
}

export function buildEventItems(data: MapData, visibility: LayerVisibility, labels: EventLabels = {}, now = Date.now()): EventItem[] {
  const items: EventItem[] = [];
  const ageH = (t: number | null) => (t ? Math.max(0, (now - t) / 3_600_000) : 48);

  if (visibility.earthquakes) {
    for (const f of data.earthquakes.features) {
      const mag = f.properties.mag ?? 0;
      const alert = f.properties.alert;
      items.push({
        key: `eq-${f.id}`,
        kind: "quake",
        selection: { kind: "quake", id: String(f.id) },
        coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        title: f.properties.place,
        subtitle: f.properties.source ?? "USGS",
        time: f.properties.time,
        score: mag * 12 + (f.properties.tsunami ? 30 : 0) + (alert ? PAGER_SCORE[alert] : 0) - ageH(f.properties.time) * 0.4,
        color: magnitudeColor(mag),
        icon: ICONS.quake,
        mag,
        depth: f.geometry.coordinates[2] ?? 0,
        tsunami: f.properties.tsunami === 1,
      });
    }
  }
  if (visibility.fires) {
    for (const f of data.fires.features) {
      const t = Date.parse(f.properties.acquiredAt);
      items.push({
        key: `fire-${f.id}`,
        kind: "fire",
        selection: { kind: "fire", id: String(f.id) },
        coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        title: `FRP ${f.properties.frp.toFixed(0)} MW`,
        subtitle: f.properties.satellite,
        time: Number.isFinite(t) ? t : null,
        score: Math.min(f.properties.frp / 8, 40) - ageH(t) * 0.5,
        color: layers.fires,
        icon: ICONS.fire,
      });
    }
  }
  if (visibility.disasters) {
    for (const f of data.disasters.features) {
      const t = f.properties.fromDate ? Date.parse(f.properties.fromDate) : null;
      items.push({
        key: `dis-${f.properties.eventId}`,
        kind: "disaster",
        selection: { kind: "disaster", id: f.properties.eventId },
        coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        title: f.properties.name,
        subtitle: labels.disasterTypes?.[f.properties.eventType] ?? f.properties.eventTypeLabel,
        time: t,
        score: ALERT_SCORE[f.properties.alertLevel],
        color: alertColor(f.properties.alertLevel),
        icon: ICONS.disaster,
        badge: labels.alertLevels?.[f.properties.alertLevel] ?? f.properties.alertLevel,
      });
    }
  }
  if (visibility.cyclones) {
    for (const f of data.cyclones.features) {
      if (f.properties.kind !== "position" || f.geometry.type !== "Point") continue;
      const cat = f.properties.category ?? "TS";
      items.push({
        key: `cyc-${f.properties.eventId}`,
        kind: "cyclone",
        selection: { kind: "cyclone", id: f.properties.eventId },
        coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        title: f.properties.name,
        subtitle: labels.stormCategories?.[cat] ?? cat,
        time: null,
        score: 55 + ALERT_SCORE[f.properties.alertLevel] / 2,
        color: stormColor(cat),
        icon: ICONS.cyclone,
        badge: cat,
      });
    }
  }
  if (visibility.volcanoes) {
    for (const f of data.volcanoes.features) {
      const isNew = f.properties.status === "new";
      items.push({
        key: `vol-${f.id}`,
        kind: "volcano",
        selection: { kind: "volcano", id: f.id },
        coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        title: f.properties.name,
        subtitle: f.properties.country,
        time: f.properties.published ? Date.parse(f.properties.published) : null,
        score: isNew ? 42 : 22,
        color: isNew ? marker.volcanoNew : marker.volcanoContinuing,
        icon: ICONS.volcano,
      });
    }
  }
  // FIRMS repite focos casi idénticos (mismo id): una fila por clave.
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
}

export interface EventsPanelProps {
  data: MapData;
  visibility: LayerVisibility;
  locale: string;
  selected: Selection | null;
  onPick: (item: EventItem) => void;
  loading?: boolean;
  error?: boolean;
  className?: string;
}

export default function EventsPanel({ data, visibility, locale, selected, onPick, loading = false, error = false, className }: EventsPanelProps) {
  const t = useTranslations("eventsPanel");
  const tEvents = useTranslations("events");
  const tMetrics = useTranslations("metrics");
  const tTypes = useTranslations("disasterTypes");
  const tAlert = useTranslations("legend.alertLevels");
  const tStorm = useTranslations("stormCategories");
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [sort, setSort] = useState<"relevant" | "recent">("relevant");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(
    () =>
      buildEventItems(data, visibility, {
        disasterTypes: Object.fromEntries(DISASTER_TYPES.map((k) => [k, tTypes(k)])),
        alertLevels: Object.fromEntries(ALERT_LEVELS.map((k) => [k, tAlert(k)])),
        stormCategories: Object.fromEntries(STORM_CATEGORIES.map((k) => [k, tStorm(k)])),
      }),
    [data, visibility, tTypes, tAlert, tStorm]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const i of all) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((i) => (kind === "all" || i.kind === kind) && (!q || `${i.title} ${i.subtitle}`.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "relevant" ? b.score - a.score : (b.time ?? 0) - (a.time ?? 0)));
  }, [all, kind, sort, query]);

  const quakes = data.earthquakes.features;
  const maxMag = quakes.reduce((m, f) => Math.max(m, f.properties.mag ?? 0), 0);
  const active = (counts.disaster ?? 0) + (counts.cyclone ?? 0) + (counts.volcano ?? 0);
  const selectedKey = selectionKey(selected);

  const chips: (EventKind | "all")[] = ["all", "quake", "fire", "disaster", "cyclone", "volcano"];

  useEffect(() => {
    if (kind !== "all" && !counts[kind]) {
      setKind("all");
      setLimit(PAGE);
    }
  }, [counts, kind]);

  function onArrowKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const options = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"], button[role="radio"]'));
    const index = options.findIndex((option) => option === e.target);
    const next = options[(index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
    next?.focus();
    next?.click();
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <StatStrip
        items={[
          { icon: Radio, color: layers.earthquakes, label: tMetrics("earthquakes24h"), value: quakes.length },
          { icon: Activity, color: magnitudeColor(maxMag), label: tMetrics("maxMagnitude"), value: maxMag ? maxMag.toFixed(1) : "—" },
          { icon: Siren, color: alertColor("Orange"), label: tMetrics("active"), value: active },
        ]}
        className="shrink-0 py-2 [&>div]:min-w-0 [&>div]:gap-0.5 [&>div]:px-3 [&_dt]:truncate [&_dt]:whitespace-nowrap [&_dt]:!text-[10px] [&_dd]:text-xl [&_dd]:leading-7"
      />

      <div className="flex h-11 shrink-0 items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-ds-control bg-white/[0.04] px-3 text-sm hover:bg-ds-hover focus-within:shadow-ds-glow focus-within:ring-2 focus-within:ring-ds-primary">
          <MorphIcon icon={Search} size={16} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={t("filter")}
            aria-label={t("filter")}
            className="h-11 min-w-0 flex-1 bg-transparent text-ds-text-primary outline-none placeholder:text-ds-text-secondary [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <div role="radiogroup" aria-label={t("sort.label")} onKeyDown={onArrowKey} className="flex h-9 shrink-0 rounded-full border border-ds-control p-0.5">
          {(["relevant", "recent"] as const).map((s) => (
            <Button
              variant="text"
              size="sm"
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              tabIndex={sort === s ? 0 : -1}
              onClick={() => setSort(s)}
              className={cn(
                "h-full px-2 text-[11px]",
                sort === s ? "bg-ds-secondary-container text-ds-secondary-on-container" : "text-ds-text-secondary hover:bg-ds-hover"
              )}
            >
              {t(`sort.${s}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="-mx-1 flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label={tEvents("title")} onKeyDown={onArrowKey}>
        {chips.map((c) => {
          const n = counts[c] ?? 0;
          if (c !== "all" && n === 0) return null;
          const activeChip = kind === c;
          return (
            <Button
              variant="text"
              size="sm"
              key={c}
              type="button"
              role="tab"
              aria-selected={activeChip}
              tabIndex={activeChip ? 0 : -1}
              onClick={() => {
                setKind(c);
                setLimit(PAGE);
              }}
              className={cn(
                "h-8 shrink-0 gap-1.5 border px-3 text-[13px]",
                activeChip
                  ? "border-transparent bg-ds-secondary-container text-ds-secondary-on-container"
                  : "border-ds-control text-ds-text-secondary hover:bg-ds-hover"
              )}
            >
              {t(`chips.${c}`)}
              <span className="tabular-nums opacity-70">{n > 999 ? "999+" : n}</span>
            </Button>
          );
        })}
      </div>

      <div role="status" aria-atomic="true" className={loading ? "text-sm text-ds-text-secondary" : "sr-only"}>
        {loading ? t("loading") : ""}
      </div>
      {error && <p role="alert" className="text-sm text-ds-error">{t("error")}</p>}
      {list.length === 0 ? !loading && !error && (
        <EmptyState icon={Inbox} title={tEvents("empty")} description={tEvents("emptyDescription")} />
      ) : (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col divide-y divide-ds-divider overflow-y-auto overscroll-contain">
          {list.slice(0, limit).map((item) => {
            const isSelected = selectionKey(item.selection) === selectedKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-ds-fast active:bg-ds-press focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-primary",
                    isSelected ? "bg-ds-secondary-container/60" : "hover:bg-ds-hover"
                  )}
                >
                  <span
                    className="ds-glow grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-[color:var(--ep-accent)] bg-[color:color-mix(in_srgb,var(--ep-accent)_12%,transparent)] text-sm font-medium tabular-nums text-[color:var(--ep-accent)]"
                    style={{ "--ep-accent": item.color } as CSSProperties}
                  >
                    {item.kind === "quake" ? <span className="text-white">{item.mag?.toFixed(1)}</span> : <MorphIcon icon={item.icon} size={18} reducedMotion="user" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ds-text-primary">{item.title}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-ds-text-secondary">
                      <span className="truncate">{item.subtitle}</span>
                      {item.depth != null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0 tabular-nums">{t("depth", { km: Math.round(item.depth) })}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {item.time != null && <span className="text-[11px] tabular-nums text-ds-text-secondary">{relativeTime(item.time, locale)}</span>}
                    {item.tsunami && (
                      <span className="rounded-ds-full bg-ds-error/15 px-2 text-[11px] font-medium text-ds-error">{t("tsunami")}</span>
                    )}
                    {item.badge && !item.tsunami && (
                      <span className="rounded-full bg-[color:color-mix(in_srgb,var(--ep-accent)_15%,transparent)] px-2 text-[11px] font-medium text-[color:var(--ep-accent)]" style={{ "--ep-accent": item.color } as CSSProperties}>
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {list.length > limit && (
            <li className="px-3 py-2">
              <Button variant="text" onClick={() => setLimit((l) => l + PAGE)} className="min-h-11">
                {t("more")} ({list.length - limit})
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
