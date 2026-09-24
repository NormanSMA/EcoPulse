'use client';

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
          <YAxis dataKey="mag" type="number" domain={[2, (max: number) => Math.ceil(max + 0.5)]} allowDecimals={false} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={32} />
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
                    M {p.mag.toFixed(1)} · {Math.round(p.depth)} km
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
          <YAxis tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} width={32} />
          <ReferenceLine y={15} stroke={scales.aqi.moderate} strokeDasharray="4 3" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => new Date(Number(v)).toLocaleString(locale)}
            formatter={(v) => [`${v} µg/m³`, "PM2.5"]}
          />
          <Area type="monotone" dataKey="v" stroke={scales.aqi.moderate} strokeWidth={2} fill="url(#air-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pronóstico 24 h: temperatura (línea) y probabilidad de lluvia (barras). */
export function ForecastChart({ hourly, locale }: { hourly: { t: string; temp: number; precipProb: number }[]; locale: string }) {
  const t = useTranslations("detail.point");
  const data = hourly.map((h) => ({ t: Date.parse(h.t), temp: h.temp, rain: h.precipProb }));
  const temps = data.map((d) => d.temp);
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            padding={{ left: 8, right: 8 }}
            ticks={data.length ? hourTicks(data[0].t, data[data.length - 1].t, 6) : undefined}
            tickFormatter={shortHour(locale)}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            yAxisId="temp"
            domain={temps.length ? [Math.floor(Math.min(...temps) - 2), Math.ceil(Math.max(...temps) + 2)] : ["auto", "auto"]}
            allowDecimals={false}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            width={32}
            unit="°"
          />
          <YAxis yAxisId="rain" orientation="right" domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} axisLine={false} tickLine={false} width={36} unit="%" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => new Date(Number(v)).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            formatter={(v, name) => (name === "temp" ? [`${v} °C`, t("temp")] : [`${v} %`, t("precipProb")])}
          />
          <Bar yAxisId="rain" dataKey="rain" fill="rgb(var(--ds-primary) / 0.25)" isAnimationActive={false} />
          <Line yAxisId="temp" type="monotone" dataKey="temp" stroke={TEMP_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-ds-text-secondary" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: TEMP_COLOR }} />
          {t("temp")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ds-primary/25" />
          {t("precipProb")}
        </span>
      </div>
    </div>
  );
}
