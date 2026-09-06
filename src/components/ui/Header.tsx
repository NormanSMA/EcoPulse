import React from "react";
import { Activity, Radio, Flame } from "lucide-react";

interface HeaderProps {
  earthquakeCount: number;
  maxMag: number;
}

export default function Header({ earthquakeCount, maxMag }: HeaderProps) {
  return (
    <header className="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-5 py-3 rounded-2xl shadow-2xl pointer-events-auto flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white">EcoPulse</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Monitor
            </span>
          </div>
          <p className="text-xs text-slate-400">Plataforma Global de Sismos y Calidad del Aire</p>
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-auto flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-rose-500" />
          <span className="text-slate-400">Sismos 24h:</span>
          <span className="font-semibold text-white">{earthquakeCount}</span>
        </div>
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="text-slate-400">Mayor Magnitud:</span>
          <span className="font-semibold text-amber-400">M {maxMag.toFixed(1)}</span>
        </div>
      </div>
    </header>
  );
}
