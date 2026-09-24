'use client';

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, X, ExternalLink, Waves, Flame, AlertTriangle, Mountain, Wind, Satellite, MapPin, Tornado, TriangleAlert } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/design-system/utils/cn";
import { layers, marker, magnitudeColor, alertColor, aqiColor, stormColor, scales } from "@/design-system/tokens";
import type { ResolvedSelection } from "@/lib/resolveSelection";
import type { SelectionKind } from "@/lib/selection";
import type { EarthquakeFeature } from "@/lib/types";
import type { PointInfo } from "@/lib/pointInfo";
import { relativeTime, formatDateTime, depthClass, compass, formatCoords, formatReportPeriod, saffirSimpson } from "@/lib/format";
import { footprintRadiusKm } from "@/lib/geoShapes";
import { getAQICategory } from "@/lib/openaq";
import { QuakeHistoryChart, AirHistoryChart, ForecastChart } from "./DetailCharts";

// ---------- Datos bajo demanda ----------

function useJson<T>(url: string | null): { data: T | null; loading: boolean } {
  const [state, setState] = useState<{ url: string | null; data: T | null }>({ url: null, data: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .then((data) => setState({ url, data }))
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setState({ url, data: null });
      });
    return () => controller.abort();
  }, [url]);
  return { data: state.url === url ? state.data : null, loading: !!url && state.url !== url };
}

// ---------- Piezas de maquetación ----------

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-ds-xl bg-ds-surface-container px-3 py-2">
      <span className="truncate text-xs text-ds-text-secondary">{label}</span>
      <span className="truncate text-base font-medium tabular-nums text-ds-text-primary">{value}</span>
      {hint && <span className="truncate text-[11px] text-ds-text-muted">{hint}</span>}
    </div>
  );
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-ds-outline-variant pt-4">
      <div>
        <h3 className="text-sm font-medium text-ds-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-ds-text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Badge({ color, children, icon }: { color: string; children: ReactNode; icon?: IconNode }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-ds-full border px-2.5 text-xs font-medium text-ds-text-primary"
      style={{ borderColor: `${color}88`, backgroundColor: `${color}26` }}
    >
      {icon && <MorphIcon icon={icon} size={13} reducedMotion="user" style={{ color }} />}
      {children}
    </span>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 self-start rounded-ds-full px-1 text-sm font-medium text-ds-primary hover:underline"
    >
      {children}
      <MorphIcon icon={ExternalLink} size={14} reducedMotion="user" />
    </a>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ds-text-muted">{children}</p>;
}

// ---------- Bloques reutilizables ----------

/** Sismicidad (30 días, 150 km) alrededor de un punto. */
function QuakeHistory({ lat, lon, selectedId, locale }: { lat: number; lon: number; selectedId?: string; locale: string }) {
  const t = useTranslations("detail.history");
  const { data, loading } = useJson<{ features: EarthquakeFeature[] }>(`/api/quake-history?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`);
  const quakes = data?.features ?? [];
  const strongest = quakes.reduce<EarthquakeFeature | null>((m, q) => (!m || (q.properties.mag ?? 0) > (m.properties.mag ?? 0) ? q : m), null);
  return (
    <Block title={t("title")} subtitle={t("subtitle")}>
      {loading ? (
        <Muted>{t("loading")}</Muted>
      ) : quakes.length === 0 ? (
        <Muted>{t("empty")}</Muted>
      ) : (
        <>
          <Stats>
            <Stat
              label={t("count")}
              value={quakes.length}
              hint={`${t("latest")}: ${relativeTime(Math.max(...quakes.map((q) => q.properties.time)), locale)}`}
            />
            {strongest && (
              <Stat
                label={t("strongest")}
                value={`M ${strongest.properties.mag?.toFixed(1)}`}
                hint={formatDateTime(strongest.properties.time, locale)}
              />
            )}
          </Stats>
          <QuakeHistoryChart quakes={quakes} selectedId={selectedId} locale={locale} />
        </>
      )}
    </Block>
  );
}

/** Tiempo actual y pronóstico 24 h en un punto (+ PM2.5 modelado). */
function PointWeather({ info, loading, locale }: { info: PointInfo | null; loading: boolean; locale: string }) {
  const t = useTranslations("detail.point");
  const tCodes = useTranslations("weatherCodes");
  if (loading) return <Muted>{t("loading")}</Muted>;
  if (!info?.current) return <Muted>{t("unavailable")}</Muted>;
  const c = info.current;
  const code = String(c.weatherCode);
  const desc = tCodes.has(code) ? tCodes(code) : "—";
  return (
    <>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-normal tabular-nums text-ds-text-primary">{Math.round(c.temperature)}°</span>
        <span className="text-sm text-ds-text-secondary">{desc}</span>
      </div>
      <Stats>
        <Stat label={t("feels")} value={`${Math.round(c.apparent)}°C`} />
        <Stat label={t("humidity")} value={`${c.humidity}%`} />
        <Stat label={t("wind")} value={`${Math.round(c.windSpeed)} km/h`} hint={compass(c.windDirection, locale)} />
        <Stat label={t("precip")} value={`${c.precipitation} mm`} />
        {info.pm25 != null && (
          <Stat label={t("airModel")} value={`${info.pm25.toFixed(1)} µg/m³`} hint={<span style={{ color: aqiColor(getAQICategory(info.pm25)) }}>●</span>} />
        )}
      </Stats>
      {info.hourly.length > 0 && (
        <Block title={t("forecast")}>
          <ForecastChart hourly={info.hourly} locale={locale} />
        </Block>
      )}
    </>
  );
}

// ---------- Panel ----------

const KIND_ICON: Record<SelectionKind, IconNode> = {
  quake: Waves,
  fire: Flame,
  disaster: AlertTriangle,
  cyclone: Tornado,
  volcano: Mountain,
  volcanoCatalog: Mountain,
  air: Wind,
  iss: Satellite,
  point: MapPin,
};

export interface DetailPanelProps {
  kind: SelectionKind;
  resolved: ResolvedSelection | null;
  locale: string;
  onClose: () => void;
  /** Variante de escritorio: muestra "volver a eventos" en vez de cerrar. */
  backToEvents?: boolean;
  className?: string;
}

export function DetailPanel({ kind, resolved, locale, onClose, backToEvents, className }: DetailPanelProps) {
  const t = useTranslations("detail");
  const tTypes = useTranslations("disasterTypes");
  const tAlert = useTranslations("legend.alertLevels");
  const tStorm = useTranslations("stormCategories");
  const item = resolved?.item;
  const coords = resolved?.coords;

  // Pronóstico/aire modelado: para puntos, ciclones y estaciones de aire.
  const wantsPoint = item && (item.kind === "point" || item.kind === "cyclone" || item.kind === "air");
  const pointUrl = wantsPoint && coords ? `/api/point?lat=${coords[1].toFixed(3)}&lon=${coords[0].toFixed(3)}&lang=${locale}` : null;
  const { data: pointInfo, loading: pointLoading } = useJson<PointInfo>(pointUrl);

  const accent = (() => {
    if (!item) return marker.selected;
    switch (item.kind) {
      case "quake":
        return magnitudeColor(item.f.properties.mag ?? 0);
      case "fire":
        return layers.fires;
      case "disaster":
        return alertColor(item.f.properties.alertLevel);
      case "cyclone":
        return stormColor(item.f.properties.category ?? "TS");
      case "volcano":
        return item.f.properties.status === "new" ? marker.volcanoNew : marker.volcanoContinuing;
      case "volcanoCatalog":
        return layers.volcanoCatalog;
      case "air":
        return aqiColor(item.f.properties.category);
      case "iss":
        return layers.iss;
      case "point":
        return marker.selected;
    }
  })();

  const title = (() => {
    if (!item) return t(`kinds.${kind}`);
    switch (item.kind) {
      case "quake":
        return `M ${item.f.properties.mag?.toFixed(1) ?? "?"} · ${item.f.properties.place}`;
      case "fire":
        return t("kinds.fire");
      case "disaster":
        return item.f.properties.name;
      case "cyclone":
        return item.f.properties.name;
      case "volcano":
      case "volcanoCatalog":
        return item.f.properties.name;
      case "air":
        return pm25Title(item.f.properties.pm25);
      case "iss":
        return "ISS";
      case "point": {
        const p = pointInfo?.place;
        return item.name ?? p?.name ?? (pointLoading ? formatCoords(item.lon, item.lat) : t("point.ocean"));
      }
    }
  })();

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Cabecera */}
      <div className="flex shrink-0 items-start gap-3 border-b border-ds-outline-variant px-4 py-3">
        {backToEvents && (
          <IconButton aria-label={t("back")} onClick={onClose} className="-ml-2 mt-1">
            <MorphIcon icon={ArrowLeft} size={20} reducedMotion="user" />
          </IconButton>
        )}
        <span
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-ds-full"
          style={{ color: accent, backgroundColor: `${accent}26` }}
        >
          <MorphIcon icon={KIND_ICON[kind]} size={20} reducedMotion="user" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-secondary">{t(`kinds.${kind}`)}</p>
          <h2 className="line-clamp-2 text-lg font-medium leading-6 text-ds-text-primary">{title}</h2>
          {coords && <p className="text-xs tabular-nums text-ds-text-muted">{formatCoords(coords[0], coords[1])}</p>}
        </div>
        {!backToEvents && (
          <IconButton aria-label={t("close")} onClick={onClose} className="-mr-2">
            <MorphIcon icon={X} size={20} reducedMotion="user" />
          </IconButton>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        {!item && <Muted>{t("unavailable")}</Muted>}

        {item?.kind === "quake" && <QuakeDetail f={item.f} locale={locale} />}

        {item?.kind === "fire" && (
          <>
            <Stats>
              <Stat label={t("fire.frp")} value={`${item.f.properties.frp.toFixed(1)} MW`} />
              <Stat
                label={t("fire.confidence")}
                value={t.has(`fire.confidenceLevels.${item.f.properties.confidence}`) ? t(`fire.confidenceLevels.${item.f.properties.confidence}`) : String(item.f.properties.confidence)}
              />
              <Stat label={t("fire.detected")} value={relativeTime(Date.parse(item.f.properties.acquiredAt), locale)} hint={formatDateTime(Date.parse(item.f.properties.acquiredAt), locale)} />
              <Stat label={t("fire.satellite")} value={item.f.properties.satellite} />
              <Stat label={t("fire.nearby")} value={item.nearby} />
            </Stats>
            <SourceLink href={`https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${coords![0].toFixed(3)},${coords![1].toFixed(3)},10.0z`}>{t("fire.viewFirms")}</SourceLink>
          </>
        )}

        {item?.kind === "disaster" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge color={alertColor(item.f.properties.alertLevel)} icon={TriangleAlert}>
                {t("disaster.alert")} {tAlert(item.f.properties.alertLevel)}
              </Badge>
            </div>
            <Stats>
              <Stat label={t("disaster.type")} value={tTypes(item.f.properties.eventType)} />
              <Stat label={t("disaster.country")} value={item.f.properties.country || "—"} />
              <Stat label={t("disaster.from")} value={item.f.properties.fromDate ? formatDateTime(Date.parse(item.f.properties.fromDate), locale) : "—"} />
              <Stat
                label={t("disaster.to")}
                value={item.f.properties.toDate && Date.parse(item.f.properties.toDate) < Date.now() ? formatDateTime(Date.parse(item.f.properties.toDate), locale) : t("disaster.ongoing")}
              />
            </Stats>
            <SourceLink href={item.f.properties.reportUrl}>{t("disaster.report")}</SourceLink>
          </>
        )}

        {item?.kind === "cyclone" && (
          <>
            <Stats>
              <Stat label={t("cyclone.category")} value={tStorm(item.f.properties.category ?? "TS")} hint={item.f.properties.category ?? "TS"} />
              <Stat label={t("cyclone.alert")} value={<span style={{ color: alertColor(item.f.properties.alertLevel) }}>{tAlert(item.f.properties.alertLevel)}</span>} />
              {item.f.properties.maxWindKmh != null && (
                <Stat
                  label={t("cyclone.maxWind")}
                  value={`${Math.round(item.f.properties.maxWindKmh)} km/h`}
                  hint={saffirSimpson(item.f.properties.maxWindKmh) ? t("cyclone.peakCategory", { n: saffirSimpson(item.f.properties.maxWindKmh)! }) : undefined}
                />
              )}
            </Stats>
            <Muted>{t("cyclone.trackNote")}</Muted>
            <SourceLink href={`https://www.gdacs.org/report.aspx?eventtype=TC&eventid=${item.f.properties.eventId.replace(/^TC-/, "")}`}>{t("cyclone.report")}</SourceLink>
            <Block title={t("point.now")}>
              <PointWeather info={pointInfo} loading={pointLoading} locale={locale} />
            </Block>
          </>
        )}

        {item?.kind === "volcano" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge color={item.f.properties.status === "new" ? marker.volcanoNew : marker.volcanoContinuing}>{t(`volcano.status.${item.f.properties.status}`)}</Badge>
            </div>
            <Stats>
              <Stat label={t("volcano.country")} value={item.f.properties.country} />
              <Stat label={t("volcano.period")} value={formatReportPeriod(item.f.properties.period, locale)} />
            </Stats>
            <Block title={t("volcano.report")}>
              <p className="text-sm leading-6 text-ds-text-primary">{item.f.properties.summary}</p>
              {item.f.properties.sources && (
                <Muted>
                  {t("volcano.sources")}: {item.f.properties.sources.replace(/,(?=\S)/g, ", ")}
                </Muted>
              )}
            </Block>
            <SourceLink href={item.f.properties.reportUrl}>{t("volcano.viewGvp")}</SourceLink>
            <QuakeHistory lat={coords![1]} lon={coords![0]} locale={locale} />
          </>
        )}

        {item?.kind === "volcanoCatalog" && (
          <>
            <Stats>
              <Stat label={t("volcanoCatalog.type")} value={item.f.properties.volcanoType} />
              <Stat label={t("volcano.country")} value={item.f.properties.country} />
              <Stat
                label={t("volcanoCatalog.lastEruption")}
                value={
                  item.f.properties.lastEruptionPeriod && t.has(`volcanoCatalog.periods.${item.f.properties.lastEruptionPeriod}`)
                    ? t(`volcanoCatalog.periods.${item.f.properties.lastEruptionPeriod}`)
                    : item.f.properties.lastEruptionYear === null
                    ? t("volcanoCatalog.noDate")
                    : item.f.properties.lastEruptionYear < 0
                      ? t("volcanoCatalog.bc", { year: Math.abs(item.f.properties.lastEruptionYear) })
                      : t("volcanoCatalog.ad", { year: item.f.properties.lastEruptionYear })
                }
              />
              <Stat label={t("volcanoCatalog.elevation")} value={item.f.properties.elevationM != null ? `${item.f.properties.elevationM} m` : "—"} />
            </Stats>
            <Muted>{t("volcanoCatalog.note")}</Muted>
            <SourceLink href={`https://volcano.si.edu/volcano.cfm?vn=${item.f.properties.volcanoNumber}`}>{t("volcano.viewGvp")}</SourceLink>
          </>
        )}

        {item?.kind === "air" && <AirDetail item={item} pointInfo={pointInfo} pointLoading={pointLoading} locale={locale} />}

        {item?.kind === "iss" && (
          <>
            <Stats>
              <Stat label={t("iss.altitude")} value={`${item.f.properties.altitudeKm.toFixed(0)} km`} />
              <Stat
                label={t("iss.speed")}
                value={`${item.f.properties.velocityKmS.toFixed(2)} km/s`}
                hint={`${Math.round(item.f.properties.velocityKmS * 3600).toLocaleString(locale)} km/h`}
              />
              <Stat label={t("iss.visibility")} value={`${Math.round(footprintRadiusKm(item.f.properties.altitudeKm)).toLocaleString(locale)} km`} />
              {item.f.properties.headingDeg != null && (
                <Stat label={t("iss.heading")} value={`${Math.round(item.f.properties.headingDeg)}°`} hint={compass(item.f.properties.headingDeg, locale)} />
              )}
            </Stats>
            <Muted>{t("iss.orbitNote")}</Muted>
          </>
        )}

        {item?.kind === "point" && (
          <>
            {item.name ? (
              item.detail && <p className="-mt-2 text-sm text-ds-text-secondary">{item.detail}</p>
            ) : (
              pointInfo?.place?.country && (
                <p className="-mt-2 text-sm text-ds-text-secondary">{[pointInfo.place.region, pointInfo.place.country].filter(Boolean).join(", ")}</p>
              )
            )}
            <PointWeather info={pointInfo} loading={pointLoading} locale={locale} />
            <QuakeHistory lat={item.lat} lon={item.lon} locale={locale} />
          </>
        )}
      </div>
    </div>
  );
}

function pm25Title(v: number) {
  return `${v.toFixed(1)} µg/m³`;
}

function QuakeDetail({ f, locale }: { f: EarthquakeFeature; locale: string }) {
  const t = useTranslations("detail");
  const p = f.properties;
  const [lon, lat, depth] = f.geometry.coordinates;
  const src = p.source ?? "USGS";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {p.tsunami === 1 && (
          <Badge color={scales.alert.Red} icon={TriangleAlert}>
            {t("tsunami")}
          </Badge>
        )}
        {p.alert && <Badge color={p.alert === "yellow" ? scales.alert.Orange : scales.alert[p.alert === "green" ? "Green" : "Red"]}>{t("pager", { level: t(`pagerLevels.${p.alert}`) })}</Badge>}
        <Badge color={marker.selected}>{src}</Badge>
      </div>
      <Stats>
        <Stat label={t("magnitude")} value={p.mag != null ? p.mag.toFixed(1) : "—"} hint={p.magType} />
        <Stat label={t("depth")} value={`${Math.round(depth ?? 0)} km`} hint={t(`depthClass.${depthClass(depth ?? 0)}`)} />
        <Stat label={t("time")} value={relativeTime(p.time, locale)} hint={formatDateTime(p.time, locale)} />
        {p.felt ? <Stat label={t("felt")} value={t("feltValue", { n: p.felt.toLocaleString(locale) })} /> : <Stat label={t("source")} value={src} />}
      </Stats>
      <SourceLink href={p.url}>{t("viewSource", { source: src })}</SourceLink>
      <QuakeHistory lat={lat} lon={lon} selectedId={String(f.id)} locale={locale} />
    </>
  );
}

function AirDetail({
  item,
  pointInfo,
  pointLoading,
  locale,
}: {
  item: Extract<NonNullable<ResolvedSelection["item"]>, { kind: "air" }>;
  pointInfo: PointInfo | null;
  pointLoading: boolean;
  locale: string;
}) {
  const t = useTranslations("detail.air");
  const tLegend = useTranslations("legend.aqiLevels");
  const p = item.f.properties;
  const url = p.locationId && p.sensorId ? `/api/air-quality/station?location=${p.locationId}&sensor=${p.sensorId}` : null;
  const { data: station, loading } = useJson<{ name: string | null; locality: string | null; country: string | null; history: { t: string; v: number }[] }>(url);
  const stationName = [station?.name, station?.locality, station?.country].filter(Boolean).join(" · ");
  const model = pointInfo?.pm25;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge color={aqiColor(p.category)}>{tLegend(p.category)}</Badge>
      </div>
      <Stats>
        <Stat label={t("pm25")} value={`${p.pm25.toFixed(1)} µg/m³`} />
        <Stat label={t("updated")} value={relativeTime(Date.parse(p.updated), locale)} hint={formatDateTime(Date.parse(p.updated), locale)} />
        <Stat
          label={t("model")}
          value={pointLoading ? "…" : model != null ? `${model.toFixed(1)} µg/m³` : "—"}
          hint={model != null ? tLegend(getAQICategory(model)) : undefined}
        />
        {stationName && <Stat label={t("station")} value={stationName} />}
      </Stats>
      <Muted>{t("modelNote")}</Muted>
      <Block title={t("history")} subtitle={t("who")}>
        {loading ? <Muted>{t("loading")}</Muted> : station?.history.length ? <AirHistoryChart history={station.history} locale={locale} /> : <Muted>{t("noHistory")}</Muted>}
      </Block>
    </>
  );
}
