'use client';

import { useState, type JSX, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  ComposedChart,
  Bar,
  Line,
  Cell,
} from "recharts";
import type { EarthquakeFeature } from "@/lib/types";
import { magnitudeColor, scales } from "@/design-system/tokens";
import type { ForecastHorizon, HourlyAirQuality, HourlyWeather } from "@/lib/forecast/types";
import { accumulate, sliceHours } from "@/lib/forecast/series";

// Gráficos del panel de detalle. Colores desde tokens (escalas de datos) y
// variables de tema (ejes, rejilla, tooltips) para que sigan claro/oscuro.

const AXIS = { fontSize: 11, fill: "rgb(var(--ds-text-secondary))" };
const GRID = "rgb(var(--ds-outline-variant))";
const TOOLTIP_STYLE = {
  background: "rgb(var(--ds-surface-container-high))",
  border: "1px solid rgb(var(--ds-outline-variant))",
  borderRadius: "var(--ds-radius-control)",
  boxShadow: "var(--ds-shadow-2)",
  color: "rgb(var(--ds-text-primary))",
  fontSize: 12,
};
const PRIMARY = "rgb(var(--ds-primary))";
// Temperatura en el tono cálido de la escala (el mismo naranja de M 4.5).
const TEMP_COLOR = scales.magnitude[1].color;

const shortDate = (locale: string) => (t: number) => new Date(t).toLocaleDateString(locale, { day: "numeric", month: "short" });
const shortHour = (locale: string) => (t: number) => new Date(t).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

/** Marcas en horas locales múltiplo de `step` (00, 06, 12, 18…) dentro del rango. */
function hourTicks(from: number, to: number, step: number): number[] {
  const ticks: number[] = [];
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  if (d.getTime() < from) d.setHours(d.getHours() + 1);
  for (; d.getTime() <= to; d.setHours(d.getHours() + 1)) if (d.getHours() % step === 0) ticks.push(d.getTime());
  return ticks;
}

/** Sismicidad de la zona: magnitud vs. tiempo (30 días); el seleccionado resaltado. */
export function QuakeHistoryChart({ quakes, selectedId, locale }: { quakes: EarthquakeFeature[]; selectedId?: string; locale: string }) {
  const t = useTranslations("detail");
  const number = new Intl.NumberFormat(locale);
  const magnitude = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const points = quakes.map((q) => ({
    t: q.properties.time,
    mag: q.properties.mag ?? 0,
    depth: q.geometry.coordinates[2] ?? 0,
    place: q.properties.place,
    selected: String(q.id) === selectedId,
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} padding={{ left: 12, right: 12 }} tickFormatter={shortDate(locale)} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis dataKey="mag" type="number" domain={[2, (max: number) => Math.ceil(max + 0.5)]} allowDecimals={false} tickFormatter={(v) => number.format(v)} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={32} />
          <ZAxis dataKey="mag" range={[30, 260]} />
          <Tooltip
            cursor={{ stroke: GRID }}
            contentStyle={TOOLTIP_STYLE}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof points)[number] | undefined;
              if (!p) return null;
              return (
                <div style={TOOLTIP_STYLE} className="px-3 py-2">
                  <div className="font-medium">
                    M {magnitude.format(p.mag)} · {number.format(Math.round(p.depth))} km
                  </div>
                  <div className="text-ds-text-secondary">{p.place}</div>
                  <div className="text-ds-text-muted">{new Date(p.t).toLocaleString(locale)}</div>
                  {p.selected && <div className="text-ds-primary">{t("history.selected")}</div>}
                </div>
              );
            }}
          />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={magnitudeColor(p.mag)}
                fillOpacity={p.selected ? 1 : 0.75}
                stroke={p.selected ? PRIMARY : "rgb(var(--ds-surface))"}
                strokeWidth={p.selected ? 3 : 1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** PM2.5 de las últimas 48 h con la guía de la OMS como referencia. */
export function AirHistoryChart({ history, locale }: { history: { t: string; v: number }[]; locale: string }) {
  const t = useTranslations("detail");
  const number = new Intl.NumberFormat(locale);
  const data = history.map((h) => ({ t: Date.parse(h.t), v: h.v }));
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="air-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={scales.aqi.moderate} stopOpacity={0.45} />
              <stop offset="100%" stopColor={scales.aqi.good} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={data.length ? hourTicks(data[0].t, data[data.length - 1].t, 12) : undefined}
            tickFormatter={shortHour(locale)}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis tickFormatter={(v) => number.format(v)} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={32} />
          <ReferenceLine y={15} stroke={scales.aqi.moderate} strokeDasharray="4 3" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => new Date(Number(v)).toLocaleString(locale)}
            formatter={(v) => [`${number.format(Number(v))} µg/m³`, t("air.pm25")]}
          />
          <Area type="monotone" dataKey="v" stroke={scales.aqi.moderate} strokeWidth={2} fill="url(#air-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type ForecastGroup = "temp" | "rain" | "wind" | "sky" | "air";
type ForecastSeries = {
  key: string;
  label: string;
  unit: string;
  color: string;
  axis: "left" | "right";
  kind?: "bar" | "area";
  dashed?: boolean;
};

/** Pronóstico por variables con horizonte y cursor temporal. */
export function ForecastChart({ weather, air, locale, cursorTime }: {
  weather: HourlyWeather;
  air: HourlyAirQuality | null;
  locale: string;
  cursorTime?: number | null;
}): JSX.Element {
  const t = useTranslations("detail.point");
  const [horizon, setHorizon] = useState<ForecastHorizon>(24);
  const [group, setGroup] = useState<ForecastGroup>("temp");
  const number = new Intl.NumberFormat(locale);
  const horizons: ForecastHorizon[] = [24, 48, 72];
  const start = weather.time[0];
  const end = weather.time[weather.time.length - 1];
  if (cursorTime != null && cursorTime >= start && cursorTime <= end) {
    const required = horizons.find((hours) => weather.time.some((time) => time >= cursorTime && time < start + hours * 3_600_000)) ?? 72;
    if (required > horizon) setHorizon(required);
  }

  const visibleWeather = sliceHours(weather, horizon);
  const visibleAir = air ? sliceHours(air, horizon, start) : null;
  const airIndices = new Map(visibleAir?.time.map((time, index) => [time, index]));
  const data = visibleWeather.time.map((time, index) => {
    const airIndex = airIndices.get(time);
    return {
      t: time,
      temp: visibleWeather.temperature[index],
      feels: visibleWeather.apparentTemperature[index],
      precipMm: visibleWeather.precipitation[index],
      precipProb: visibleWeather.precipitationProbability[index],
      wind: visibleWeather.windSpeed[index],
      gusts: visibleWeather.windGusts[index],
      cloudCover: visibleWeather.cloudCover[index],
      uv: visibleWeather.uvIndex[index],
      pm25: airIndex !== undefined ? visibleAir?.pm25[airIndex] ?? null : null,
      pm10: airIndex !== undefined ? visibleAir?.pm10[airIndex] ?? null : null,
      usAqi: airIndex !== undefined ? visibleAir?.usAqi[airIndex] ?? null : null,
    };
  });
  const groups: { value: ForecastGroup; label: string }[] = [
    { value: "temp", label: t("groupTemp") },
    { value: "rain", label: t("groupRain") },
    { value: "wind", label: t("groupWind") },
    { value: "sky", label: t("groupSky") },
    { value: "air", label: t("groupAir") },
  ];
  const seriesByGroup: Record<ForecastGroup, ForecastSeries[]> = {
    temp: [
      { key: "temp", label: t("temp"), unit: "°C", color: TEMP_COLOR, axis: "left" },
      { key: "feels", label: t("feels"), unit: "°C", color: PRIMARY, axis: "left", dashed: true },
    ],
    rain: [
      { key: "precipMm", label: t("precipMm"), unit: "mm", color: PRIMARY, axis: "left", kind: "bar" },
      { key: "precipProb", label: t("precipProb"), unit: "%", color: TEMP_COLOR, axis: "right" },
    ],
    wind: [
      { key: "wind", label: t("wind"), unit: "km/h", color: PRIMARY, axis: "left" },
      { key: "gusts", label: t("gusts"), unit: "km/h", color: TEMP_COLOR, axis: "left", dashed: true },
    ],
    sky: [
      { key: "cloudCover", label: t("cloudCover"), unit: "%", color: PRIMARY, axis: "left", kind: "area" },
      { key: "uv", label: t("uv"), unit: "", color: TEMP_COLOR, axis: "right" },
    ],
    air: [
      { key: "pm25", label: t("pm25"), unit: "µg/m³", color: TEMP_COLOR, axis: "left" },
      { key: "pm10", label: t("pm10"), unit: "µg/m³", color: PRIMARY, axis: "left" },
      { key: "usAqi", label: t("usAqi"), unit: "", color: scales.aqi.moderate, axis: "right" },
    ],
  };
  const series = seriesByGroup[group];
  const secondary = series.find((item) => item.axis === "right");
  const accumulated = accumulate(visibleWeather.precipitation);
  const total = accumulated[accumulated.length - 1] ?? 0;
  const cursorVisible = cursorTime != null && data.length > 0 && cursorTime >= data[0].t && cursorTime <= data[data.length - 1].t;
  const unavailable = group === "air" && air === null;
  const onRadioKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    const index = radios.findIndex((radio) => radio === event.target);
    const next = radios[(index + (event.key === "ArrowRight" ? 1 : -1) + radios.length) % radios.length];
    next?.focus();
    next?.click();
  };
  const radioClass = "min-h-11 min-w-11 rounded-ds-full border border-ds-outline px-3 py-2 text-xs font-medium text-ds-text-secondary hover:bg-ds-hover active:bg-ds-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ds-surface aria-checked:border-ds-primary aria-checked:bg-ds-primary/10 aria-checked:text-ds-primary";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div role="radiogroup" aria-label={t("horizon")} onKeyDown={onRadioKeyDown} className="flex flex-wrap gap-1">
        {horizons.map((hours) => (
          <button key={hours} type="button" role="radio" aria-checked={horizon === hours} tabIndex={horizon === hours ? 0 : -1} onClick={() => setHorizon(hours)} className={radioClass}>
            {t("hours", { n: hours })}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={t("group")} onKeyDown={onRadioKeyDown} className="flex flex-wrap gap-1">
        {groups.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={group === option.value} tabIndex={group === option.value || (unavailable && option.value === "temp") ? 0 : -1} disabled={option.value === "air" && air === null} onClick={() => setGroup(option.value)} className={radioClass}>
            {option.label}
          </button>
        ))}
      </div>
      {unavailable ? <p role="status" className="text-xs text-ds-text-secondary">{t("airUnavailable")}</p> : <>
      <div className="h-44 w-full min-w-0" role="img" aria-label={t("forecastTitle")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            padding={{ left: 8, right: 8 }}
            ticks={data.length ? hourTicks(data[0].t, data[data.length - 1].t, horizon === 24 ? 6 : horizon === 48 ? 12 : 24) : undefined}
            tickFormatter={shortHour(locale)}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            domain={group === "sky" ? [0, 100] : group === "temp" ? ["auto", "auto"] : [0, "auto"]}
            tickFormatter={(v) => number.format(v)}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            width={48}
            label={{ value: series[0].unit, position: "insideTopLeft", ...AXIS }}
          />
          {secondary && <YAxis yAxisId="right" orientation="right" domain={group === "rain" ? [0, 100] : [0, "auto"]} tickFormatter={(v) => number.format(v)} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={40} unit={secondary.unit} />}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => new Date(Number(v)).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            formatter={(v, name) => {
              const item = series.find((entry) => entry.key === name);
              return [`${number.format(Number(v))}${item?.unit ? ` ${item.unit}` : ""}`, item?.label ?? name];
            }}
          />
          {series.map((item) => item.kind === "bar" ? (
            <Bar key={item.key} yAxisId={item.axis} dataKey={item.key} fill={item.color} fillOpacity={0.35} isAnimationActive={false} />
          ) : item.kind === "area" ? (
            <Area key={item.key} yAxisId={item.axis} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2} fill={item.color} fillOpacity={0.25} isAnimationActive={false} />
          ) : (
            <Line key={item.key} yAxisId={item.axis} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2} strokeDasharray={item.dashed ? "4 3" : undefined} dot={false} isAnimationActive={false} />
          ))}
          {cursorVisible && <ReferenceLine x={cursorTime} yAxisId="left" stroke="rgb(var(--ds-highlight))" strokeWidth={2} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {group === "rain" && <p className="text-xs text-ds-text-secondary">{t("precipAccum")}: {number.format(total)} mm</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-text-secondary">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 16 12" className="h-3 w-4 shrink-0" aria-hidden="true">
              {item.kind ? <rect x="1" y="1" width="14" height="10" rx="2" fill={item.color} fillOpacity={0.35} /> : <line x1="0" y1="6" x2="16" y2="6" stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? "4 3" : undefined} />}
            </svg>
            {item.label}
          </span>
        ))}
      </div>
      </>}
    </div>
  );
}

/** Sismos M ≥ 7 por década a lo largo de un límite de placa. */
export function DecadeChart({ data, locale }: { data: { decade: number; count: number }[]; locale: string }) {
  const t = useTranslations("detail.tectonics");
  const year = new Intl.NumberFormat(locale, { useGrouping: false });
  const number = new Intl.NumberFormat(locale);
  const formatDecade = (decade: unknown) => t("decade", { year: year.format(Number(decade)) });
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="decade" tickFormatter={formatDecade} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickFormatter={(v) => number.format(v)} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={32} />
          <Tooltip
            cursor={{ fill: "rgb(var(--ds-primary) / 0.1)" }}
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatDecade}
            formatter={(v) => [number.format(Number(v)), "M ≥ 7"]}
          />
          <Bar dataKey="count" fill={PRIMARY} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
