import { useTranslations } from "next-intl";
import { Mountain, CloudSun, Flame, Satellite, Palette, MapPin, Info } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { layers, type LayerKey } from "@/design-system/tokens";
import { LayerToggle, Switch } from "@/components/ui/LayerToggle";
import { cn } from "@/design-system/utils/cn";
import { Section } from "@/components/ui/Section";
import { Legend } from "@/components/ui/Legend";
import NearbySearch from "@/components/ui/NearbySearch";

export const MAG_STEPS = [0, 3, 4, 5, 6, 7] as const;

export type LayerVisibility = Record<LayerKey, boolean>;

interface LayerDef {
  key: LayerKey;
  tag?: string;
  ring?: boolean;
}

// Agrupación temática de las 8 capas. `tag` = fuente de datos (nombre
// propio, no se traduce).
const GROUPS: { id: "geo" | "atmosphere" | "hazards" | "space"; icon: IconNode; layers: LayerDef[] }[] = [
  {
    id: "geo",
    icon: Mountain,
    layers: [
      { key: "earthquakes", tag: "USGS · EMSC" },
      { key: "volcanoes", tag: "GVP" },
      { key: "volcanoCatalog", tag: "GVP", ring: true },
      { key: "tectonics", tag: "PB2002" },
    ],
  },
  {
    id: "atmosphere",
    icon: CloudSun,
    layers: [
      { key: "airQuality", tag: "OpenAQ" },
      { key: "radar", tag: "RainViewer" },
    ],
  },
  {
    id: "hazards",
    icon: Flame,
    layers: [
      { key: "fires", tag: "FIRMS" },
      { key: "disasters", tag: "GDACS" },
      { key: "cyclones", tag: "GDACS" },
    ],
  },
  {
    id: "space",
    icon: Satellite,
    layers: [
      { key: "iss", tag: "NASA" },
      { key: "dayNight" },
    ],
  },
];

export interface ControlsPanelProps {
  visibility: LayerVisibility;
  onChange: (key: LayerKey, value: boolean) => void;
  /** La leyenda flotante ya se muestra aparte (xl+): se omite aquí. */
  showLegend?: boolean;
  /** Magnitud mínima de los sismos mostrados (0 = todos). */
  minMag: number;
  onMinMagChange: (value: number) => void;
}

/**
 * Contenido del panel "Controles" (izquierda en escritorio, bottom sheet en
 * móvil): grupos de capas con switch maestro, leyenda y búsqueda cercana.
 */
export default function ControlsPanel({ visibility, onChange, showLegend = true, minMag, onMinMagChange }: ControlsPanelProps) {
  const t = useTranslations("layers");
  const tPanel = useTranslations("panel");
  const tNearby = useTranslations("nearby");

  return (
    <div className="flex flex-col">
      {GROUPS.map((group) => {
        const on = group.layers.filter((l) => visibility[l.key]).length;
        return (
          <Section
            key={group.id}
            title={t(`groups.${group.id}`)}
            icon={group.icon}
            meta={`${on}/${group.layers.length}`}
            trailing={
              // Como los toggles de sección de Weather Lab: la sección está
              // activa si alguna capa lo está; apagarla apaga todo el grupo.
              <Switch
                checked={on > 0}
                label={t(`groups.${group.id}`)}
                onChange={(v) => group.layers.forEach((l) => onChange(l.key, v))}
              />
            }
          >
            <div className="flex flex-col gap-0.5 pl-2">
              {group.layers.map((l) => (
                <LayerToggle
                  key={l.key}
                  label={t(l.key)}
                  tag={l.tag}
                  swatch={layers[l.key]}
                  swatchRing={l.ring}
                  checked={visibility[l.key]}
                  onChange={(v) => onChange(l.key, v)}
                />
              ))}
            </div>
            {group.id === "geo" && visibility.earthquakes && (
              <div role="group" aria-label={t("minMag")} className="mt-2 flex flex-col gap-1.5 pl-4 pr-2">
                <span className="text-xs text-ds-text-secondary">{t("minMag")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {MAG_STEPS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={minMag === m}
                      onClick={() => onMinMagChange(m)}
                      className={cn(
                        "h-8 min-w-11 rounded-ds-full border px-3 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary",
                        minMag === m
                          ? "border-transparent bg-ds-secondary-container text-ds-text-primary"
                          : "border-ds-outline text-ds-text-secondary hover:bg-ds-hover"
                      )}
                    >
                      {m === 0 ? t("minMagAll") : `${m}+`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>
        );
      })}

      {showLegend && (
        <Section title={tPanel("legend")} icon={Palette} defaultOpen={false}>
          <Legend visibility={visibility} />
        </Section>
      )}

      <Section title={tNearby("title")} icon={MapPin} defaultOpen={false}>
        <NearbySearch />
      </Section>

      <p className="flex items-start gap-2 border-t border-ds-outline-variant px-4 pb-1 pt-3 text-xs text-ds-text-muted">
        <MorphIcon icon={Info} size={14} reducedMotion="user" className="mt-px shrink-0" />
        <span>{t("hint")}</span>
      </p>
    </div>
  );
}
