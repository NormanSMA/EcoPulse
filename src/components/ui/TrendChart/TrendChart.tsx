import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { EarthquakeGeoJSON } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";

export interface TrendChartProps {
  earthquakes: EarthquakeGeoJSON;
  selectedEarthquakeId: string | null;
  className?: string;
}

const NEARBY_DEGREES = 2;
const LIVE_COLOR = "#10b981"; // token status.live

function formatHour(timeMs: number, multiDay: boolean) {
  const d = new Date(timeMs);
  if (multiDay) {
    return d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function TrendChart({ earthquakes, selectedEarthquakeId, className }: TrendChartProps) {
  const t = useTranslations("events.trend");

  const selected = useMemo(
    () => earthquakes.features.find((f) => String(f.id) === selectedEarthquakeId) ?? null,
    [earthquakes, selectedEarthquakeId]
  );

  const nearby = useMemo(() => {
    if (!selected) return [];
    const [selLon, selLat] = selected.geometry.coordinates;

    return earthquakes.features
      .filter((f) => {
        const [lon, lat] = f.geometry.coordinates;
        return Math.abs(lon - selLon) <= NEARBY_DEGREES && Math.abs(lat - selLat) <= NEARBY_DEGREES;
      })
      .sort((a, b) => a.properties.time - b.properties.time);
  }, [earthquakes, selected]);

  if (!selectedEarthquakeId || !selected) {
    return <EmptyState title={t("selectPrompt")} className={className} />;
  }

  if (nearby.length <= 1) {
    return <EmptyState title={t("noAftershocks")} className={className} />;
  }

  const multiDay =
    nearby[nearby.length - 1].properties.time - nearby[0].properties.time > 24 * 60 * 60 * 1000;

  const data = nearby.map((f) => ({
    time: f.properties.time,
    timeLabel: formatHour(f.properties.time, multiDay),
    mag: f.properties.mag ?? 0,
  }));

  const maxMag = Math.max(...data.map((d) => d.mag));

  return (
    <div className={className} style={{ minHeight: 150 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={150}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="timeLabel"
            tick={{ fontSize: 10, fill: "var(--ds-text-secondary)" }}
            axisLine={{ stroke: "var(--ds-border-subtle)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxMag + 1]}
            tick={{ fontSize: 10, fill: "var(--ds-text-secondary)" }}
            axisLine={{ stroke: "var(--ds-border-subtle)" }}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "var(--ds-bg-surface-elevated)",
              border: "1px solid var(--ds-border-subtle)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [Number(value).toFixed(1), t("magnitude")]}
            labelFormatter={(label) => `${t("time")}: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="mag"
            stroke={LIVE_COLOR}
            fill={LIVE_COLOR}
            fillOpacity={0.2}
            dot={{ r: 3, fill: LIVE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
