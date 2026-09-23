import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { scales, layers, type LayerKey } from "@/design-system/tokens";
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
const AQI_ORDER = ["good", "moderate", "unhealthy", "hazardous"] as const;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-ds-text-secondary">{title}</span>
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
      <div className="h-2 w-full rounded-ds-full" style={{ background: MAG_GRADIENT }} />
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
          <span key={s.key} className="flex-1" style={{ backgroundColor: s.color }} />
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
          "flex w-64 flex-col gap-3 rounded-ds-2xl border border-ds-outline-variant bg-ds-panel px-4 py-3 shadow-ds-2 backdrop-blur-ds-panel",
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
      <div className="h-2 w-full rounded-ds-full" style={{ background: FIRE_GRADIENT }} />
      <div className="flex justify-between text-[11px] text-ds-text-muted">
        <span>{t("low")}</span>
        <span>{t("high")}</span>
      </div>
    </Block>
  );

  const aqi = (on("airQuality") || on("airQualityModel")) && (
    <Block title={t("aqi")}>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
        {AQI_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: scales.aqi[k] }} />
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
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: scales.alert[k] }} />
            {t(`alertLevels.${k}`)}
          </li>
        ))}
      </ul>
    </Block>
  );

  const empty = ![magnitude, storms, fires, aqi, alerts].some(Boolean);
  return (
    <div className={cn("flex flex-col gap-4 px-3", className)}>
      {magnitude}
      {storms}
      {fires}
      {aqi}
      {alerts}
      {empty && <p className="text-xs text-ds-text-muted">{t("empty")}</p>}
    </div>
  );
}
