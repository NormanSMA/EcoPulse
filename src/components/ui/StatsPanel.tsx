import React from "react";
import { Layers, Info } from "lucide-react";

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
}: StatsPanelProps) {
  return (
    <aside className="absolute bottom-6 left-4 z-10 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="h-4 w-4 text-indigo-400" />
          <span>Capas Activas</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <span className="text-slate-200">Sismos Recientes (USGS)</span>
          </div>
          <input
            type="checkbox"
            checked={showQuakes}
            onChange={(e) => setShowQuakes(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-slate-200">Calidad del Aire (PM2.5)</span>
          </div>
          <input
            type="checkbox"
            checked={showAirQuality}
            onChange={(e) => setShowAirQuality(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            <span className="text-slate-200">Incendios (NASA FIRMS)</span>
          </div>
          <input
            type="checkbox"
            checked={showFires}
            onChange={(e) => setShowFires(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
            <span className="text-slate-200">Clima (Open-Meteo)</span>
          </div>
          <input
            type="checkbox"
            checked={showWeather}
            onChange={(e) => setShowWeather(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="text-slate-200">Desastres Globales (GDACS)</span>
          </div>
          <input
            type="checkbox"
            checked={showDisasters}
            onChange={(e) => setShowDisasters(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.6)]" />
            <span className="text-slate-200">Estación Espacial (ISS)</span>
          </div>
          <input
            type="checkbox"
            checked={showIss}
            onChange={(e) => setShowIss(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-slate-300 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
        <span>Haz clic sobre cualquier círculo para ver detalles de magnitud o partículas en tiempo real.</span>
      </div>
    </aside>
  );
}
