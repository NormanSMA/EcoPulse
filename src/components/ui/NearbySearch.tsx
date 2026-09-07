'use client';

import React, { useState } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NearbyEarthquakeRow } from "@/lib/types";

const RADIUS_OPTIONS_KM = [50, 100, 250, 500] as const;

type Status = "idle" | "locating" | "loading" | "error";

export default function NearbySearch() {
  const [radiusKm, setRadiusKm] = useState<number>(100);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [results, setResults] = useState<NearbyEarthquakeRow[]>([]);

  function handleSearch() {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    setStatus("locating");
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus("loading");
        const { latitude, longitude } = position.coords;

        const { data, error } = await supabase.rpc("get_earthquakes_near", {
          lat: latitude,
          lon: longitude,
          radius_meters: radiusKm * 1000,
        });

        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }

        setResults((data ?? []) as NearbyEarthquakeRow[]);
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setErrorMessage("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
      }
    );
  }

  return (
    <aside className="absolute bottom-6 right-4 z-10 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
        <MapPin className="h-4 w-4 text-indigo-400" />
        <span>Sismos Cerca de Mi</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">Radio:</span>
        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 flex-1"
        >
          {RADIUS_OPTIONS_KM.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSearch}
        disabled={status === "locating" || status === "loading"}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition"
      >
        {(status === "locating" || status === "loading") && (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        {status === "locating" ? "Ubicando..." : status === "loading" ? "Buscando..." : "Usar mi ubicación"}
      </button>

      {status === "error" && (
        <div className="flex items-start gap-1.5 text-[11px] text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
          <p className="text-slate-400">{results.length} sismo(s) encontrados:</p>
          {results.map((eq) => (
            <div key={eq.id} className="bg-slate-800/50 rounded-lg px-2 py-1.5 flex justify-between gap-2">
              <span className="text-slate-200 truncate">{eq.place}</span>
              <span className="text-amber-400 font-semibold shrink-0">M {eq.magnitude ?? "N/D"}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
