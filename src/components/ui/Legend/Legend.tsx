import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { scales, layers, marker, type LayerKey } from "@/design-system/tokens";
import { boundaryColor } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";

export interface LegendProps {
  /** `floating`: pill sobre el mapa (esquina inferior derecha, como Weather Lab). */
  variant?: "inline" | "floating";
  /** Solo se muestran las escalas de las capas activas. */
  visibility?: Partial<Record<LayerKey, boolean>>;
  className?: string;
}

const MAG_GRADIENT = `linear-gradient(90deg, ${scales.magnitude.map((s) => s.color).join(", ")})`;
const FIRE_GRADIENT = `linear-gradient(90deg, ${scales.magnitude[0].color}66, ${layers.fires}, ${scales.magnitude[2].color})`;
// Paleta "Universal Blue" de RainViewer (la única que sirve su API gratuita).
const RADAR_GRADIENT = `linear-gradient(90deg, ${scales.radar.join(", ")})`;
const AQI_ORDER = ["good", "moderate", "unhealthy", "hazardous"] as const;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="ds-eyebrow">{title}</span>
      {children}
    </div>
  );
}

/** Leyenda de escalas de color, derivada 1:1 de tokens/colors.ts → scales. */
export function Legend({ variant = "inline", visibility, className }: LegendProps) {
  const t = useTranslations("legend");
  const on = (k: LayerKey) => !visibility || visibility[k] !== false;

  const magnitude = on("earthquakes") && (
    <Block title={t("magnitude")}>
      <div className="h-2 w-full rounded-full bg-[image:var(--ep-gradient)]" style={{ "--ep-gradient": MAG_GRADIENT } as CSSProperties} />
      <div className="flex justify-between text-[11px] tabular-nums text-ds-text-muted">
        {scales.magnitude.map((s) => (
          <span key={s.stop}>{s.stop}</span>
        ))}
      </div>
    </Block>
  );

  const storms = on("cyclones") && (
    <Block title={t("storm")}>
      <div className="flex h-2 w-full overflow-hidden rounded-ds-full">
        {scales.storm.map((s) => (
          <span key={s.key} className="flex-1 bg-[color:var(--ep-accent)]" style={{ "--ep-accent": s.color } as CSSProperties} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-ds-text-muted">
        {scales.storm.map((s) => (
          <span key={s.key}>{s.key}</span>
        ))}
      </div>
    </Block>
  );

  if (variant === "floating") {
    if (!magnitude && !storms) return null;
    return (
      <div
        className={cn(
          "ds-glass flex w-64 max-w-full flex-col gap-3 rounded-ds-card px-3 py-3",
          className
        )}
      >
        {magnitude}
        {storms}
      </div>
    );
  }

  const fires = on("fires") && (
    <Block title={t("fires")}>
      <div className="h-2 w-full rounded-full bg-[image:var(--ep-gradient)]" style={{ "--ep-gradient": FIRE_GRADIENT } as CSSProperties} />
      <div className="flex justify-between text-[11px] text-ds-text-muted">
        <span>{t("low")}</span>
        <span>{t("high")}</span>
      </div>
    </Block>
  );

  const aqi = on("airQuality") && (
    <Block title={t("aqi")}>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
        {AQI_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
            <span aria-hidden="true" className="ds-glow h-3 w-3 shrink-0 rounded-full bg-[color:var(--ep-accent)]" style={{ "--ep-accent": scales.aqi[k] } as CSSProperties} />
            {t(`aqiLevels.${k}`)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const alerts = on("disasters") && (
    <Block title={t("alert")}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {(["Green", "Orange", "Red"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
            <span aria-hidden="true" className="ds-glow h-3 w-3 shrink-0 rounded-full bg-[color:var(--ep-accent)]" style={{ "--ep-accent": scales.alert[k] } as CSSProperties} />
            {t(`alertLevels.${k}`)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const volcanoes = on("volcanoes") && (
    <Block title={t("volcanoes")}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {([
          ["new", marker.volcanoNew],
          ["continuing", marker.volcanoContinuing],
        ] as const).map(([k, color]) => (
          <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
            <span aria-hidden="true" className="ds-glow h-3 w-3 shrink-0 rounded-full bg-[color:var(--ep-accent)]" style={{ "--ep-accent": color } as CSSProperties} />
            {t(`volcanoStatus.${k}`)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const radar = on("radar") && (
    <Block title={t("radar")}>
      <div className="h-2 w-full rounded-full bg-[image:var(--ep-gradient)]" style={{ "--ep-gradient": RADAR_GRADIENT } as CSSProperties} />
      <div className="flex justify-between text-[11px] text-ds-text-muted">
        <span>{t("light")}</span>
        <span>{t("heavy")}</span>
      </div>
    </Block>
  );

  const boundaries = on("tectonics") && (
    <Block title={t("boundary")}>
      <ul className="flex flex-col gap-2">
        {(["divergent", "convergent", "transform"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
            <span
              aria-hidden="true"
              className={cn("ds-glow h-3 w-3 shrink-0 rounded-full border-2 border-[color:var(--ep-accent)] bg-[color:color-mix(in_srgb,var(--ep-accent)_30%,transparent)]", k === "transform" && "border-dashed")}
              style={{ "--ep-accent": boundaryColor(k) } as CSSProperties}
            />
            {t(`boundaryTypes.${k}`)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const empty = ![magnitude, storms, fires, aqi, alerts, volcanoes, radar, boundaries].some(Boolean);
  return (
    <div className={cn("ds-glass flex min-w-0 flex-col gap-3 rounded-ds-card p-3", className)}>
      {magnitude}
      {storms}
      {fires}
      {aqi}
      {alerts}
      {volcanoes}
      {radar}
      {boundaries}
      {empty && <p className="text-xs text-ds-text-muted">{t("empty")}</p>}
    </div>
  );
}
