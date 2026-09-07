import { useTranslations } from "next-intl";
import { Layers, Info } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Card } from "@/components/ui/Card";
import { LayerToggle } from "@/components/ui/LayerToggle";

interface StatsPanelProps {
  showQuakes: boolean;
  setShowQuakes: (val: boolean) => void;
  showAirQuality: boolean;
  setShowAirQuality: (val: boolean) => void;
  showFires: boolean;
  setShowFires: (val: boolean) => void;
  showWeather: boolean;
  setShowWeather: (val: boolean) => void;
  showDisasters: boolean;
  setShowDisasters: (val: boolean) => void;
  showIss: boolean;
  setShowIss: (val: boolean) => void;
  showVolcanoes: boolean;
  setShowVolcanoes: (val: boolean) => void;
  showAirQualityModel: boolean;
  setShowAirQualityModel: (val: boolean) => void;
}

export default function StatsPanel({
  showQuakes,
  setShowQuakes,
  showAirQuality,
  setShowAirQuality,
  showFires,
  setShowFires,
  showWeather,
  setShowWeather,
  showDisasters,
  setShowDisasters,
  showIss,
  setShowIss,
  showVolcanoes,
  setShowVolcanoes,
  showAirQualityModel,
  setShowAirQualityModel,
}: StatsPanelProps) {
  const t = useTranslations("layers");

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-ds-border">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ds-text-secondary">
          <MorphIcon icon={Layers} size={16} reducedMotion="user" className="text-indigo-400" />
          <span>{t("title")}</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <LayerToggle
          label={t("earthquakes")}
          dotColorClassName="bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
          checked={showQuakes}
          onChange={setShowQuakes}
        />
        <LayerToggle
          label={t("airQuality")}
          dotColorClassName="bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
          checked={showAirQuality}
          onChange={setShowAirQuality}
        />
        <LayerToggle
          label={t("fires")}
          dotColorClassName="bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
          checked={showFires}
          onChange={setShowFires}
        />
        <LayerToggle
          label={t("weather")}
          dotColorClassName="bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"
          checked={showWeather}
          onChange={setShowWeather}
        />
        <LayerToggle
          label={t("disasters")}
          dotColorClassName="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          checked={showDisasters}
          onChange={setShowDisasters}
        />
        <LayerToggle
          label={t("iss")}
          dotColorClassName="bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.6)]"
          checked={showIss}
          onChange={setShowIss}
        />
        <LayerToggle
          label={t("volcanoes")}
          dotColorClassName="bg-yellow-700 shadow-[0_0_8px_rgba(161,98,7,0.6)]"
          checked={showVolcanoes}
          onChange={setShowVolcanoes}
        />
        <LayerToggle
          label={t("airQualityModel")}
          dotColorClassName="border-2 border-cyan-400"
          checked={showAirQualityModel}
          onChange={setShowAirQualityModel}
        />
      </div>

      <div className="pt-2 border-t border-ds-border text-[11px] text-ds-text-muted flex items-start gap-1.5">
        <MorphIcon icon={Info} size={14} reducedMotion="user" className="shrink-0 mt-0.5 text-ds-text-muted" />
        <span>{t("hint")}</span>
      </div>
    </Card>
  );
}
