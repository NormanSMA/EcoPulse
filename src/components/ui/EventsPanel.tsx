'use client';

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Waves, Flame, AlertTriangle, Mountain, Tornado, Search, Inbox, Radio, Activity, Siren } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { layers, marker, magnitudeColor, alertColor, stormColor } from "@/design-system/tokens";
import { relativeTime } from "@/lib/format";
import { selectionKey, type Selection } from "@/lib/selection";
import type { MapData, LayerVisibility } from "@/components/map/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";

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
  className?: string;
}

export default function EventsPanel({ data, visibility, locale, selected, onPick, className }: EventsPanelProps) {
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

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="grid shrink-0 grid-cols-3 gap-2">
        <MetricCard icon={Radio} iconColor={layers.earthquakes} label={tMetrics("earthquakes24h")} value={quakes.length} compact />
        <MetricCard icon={Activity} iconColor={magnitudeColor(maxMag)} label={tMetrics("maxMagnitude")} value={maxMag ? maxMag.toFixed(1) : "—"} compact />
        <MetricCard icon={Siren} iconColor={alertColor("Orange")} label={tMetrics("active")} value={active} compact />
      </div>

      <label className="flex h-10 shrink-0 items-center gap-2 rounded-ds-full bg-ds-surface-high px-3 text-sm focus-within:ring-2 focus-within:ring-ds-primary">
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
          className="min-w-0 flex-1 bg-transparent text-ds-text-primary outline-none placeholder:text-ds-text-secondary [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist">
        {chips.map((c) => {
          const n = counts[c] ?? 0;
          if (c !== "all" && n === 0) return null;
          const activeChip = kind === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={activeChip}
              onClick={() => {
                setKind(c);
                setLimit(PAGE);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-ds-md border px-3 text-[13px] font-medium transition-colors duration-ds-fast",
                activeChip
                  ? "border-transparent bg-ds-secondary-container text-ds-secondary-on-container"
                  : "border-ds-outline-variant text-ds-text-secondary hover:bg-ds-hover"
              )}
            >
              {t(`chips.${c}`)}
              <span className="tabular-nums opacity-70">{n > 999 ? "999+" : n}</span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label={t("sort.label")} className="flex h-8 shrink-0 self-start rounded-ds-full border border-ds-outline p-0.5">
        {(["relevant", "recent"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={sort === s}
            onClick={() => setSort(s)}
            className={cn(
              "rounded-ds-full px-3 text-xs font-medium transition-colors",
              sort === s ? "bg-ds-secondary-container text-ds-secondary-on-container" : "text-ds-text-secondary hover:bg-ds-hover"
            )}
          >
            {t(`sort.${s}`)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Inbox} title={tEvents("empty")} description={tEvents("emptyDescription")} />
      ) : (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
          {list.slice(0, limit).map((item) => {
            const isSelected = selectionKey(item.selection) === selectedKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-ds-control px-3 py-2.5 text-left transition-colors duration-ds-fast",
                    isSelected ? "bg-ds-secondary-container/60" : "hover:bg-ds-hover"
                  )}
                >
                  {item.kind === "quake" ? (
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-full text-sm font-medium tabular-nums"
                      style={{ color: item.color, backgroundColor: `${item.color}26`, boxShadow: `inset 0 0 0 1.5px ${item.color}66` }}
                    >
                      {item.mag?.toFixed(1)}
                    </span>
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-full" style={{ color: item.color, backgroundColor: `${item.color}26` }}>
                      <MorphIcon icon={item.icon} size={18} reducedMotion="user" />
                    </span>
                  )}
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
                    {item.time != null && <span className="text-[11px] tabular-nums text-ds-text-muted">{relativeTime(item.time, locale)}</span>}
                    {item.tsunami && (
                      <span className="rounded-ds-full bg-ds-error/15 px-2 text-[11px] font-medium text-ds-error">{t("tsunami")}</span>
                    )}
                    {item.badge && !item.tsunami && (
                      <span className="rounded-ds-full px-2 text-[11px] font-medium" style={{ color: item.color, backgroundColor: `${item.color}26` }}>
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
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="text-sm font-medium text-ds-primary hover:underline">
                {t("more")} ({list.length - limit})
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
