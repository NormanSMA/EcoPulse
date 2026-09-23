import { useTranslations } from "next-intl";
import { scales } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";

export interface LegendProps {
  /** `floating`: pill sobre el mapa (esquina inferior derecha, como Weather Lab). */
  variant?: "inline" | "floating";
  className?: string;
}

const MAG_GRADIENT = `linear-gradient(90deg, ${scales.magnitude.map((s) => s.color).join(", ")})`;
const AQI_ORDER = ["good", "moderate", "unhealthy", "hazardous"] as const;

/** Leyenda de escalas de color, derivada 1:1 de tokens/colors.ts → scales. */
export function Legend({ variant = "inline", className }: LegendProps) {
  const t = useTranslations("legend");

  const magnitude = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-ds-text-secondary">{t("magnitude")}</span>
      <div className="h-2 w-full rounded-ds-full" style={{ background: MAG_GRADIENT }} />
      <div className="flex justify-between text-[11px] tabular-nums text-ds-text-muted">
        {scales.magnitude.map((s) => (
          <span key={s.stop}>{s.stop}</span>
        ))}
      </div>
    </div>
  );

  if (variant === "floating") {
    return (
      <div
        className={cn(
          "flex w-64 flex-col gap-1.5 rounded-ds-2xl border border-ds-outline-variant bg-ds-panel px-4 py-3 shadow-ds-2 backdrop-blur-ds-panel",
          className
        )}
      >
        {magnitude}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 px-3", className)}>
      {magnitude}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-ds-text-secondary">{t("aqi")}</span>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
          {AQI_ORDER.map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
              <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: scales.aqi[k] }} />
              {t(`aqiLevels.${k}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-ds-text-secondary">{t("alert")}</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {(["Green", "Orange", "Red"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs text-ds-text-primary">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: scales.alert[k] }} />
              {t(`alertLevels.${k}`)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
