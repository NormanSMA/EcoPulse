'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Loader2, AlertTriangle } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { NearbyEarthquakeRow } from "@/lib/types";

const RADIUS_OPTIONS_KM = [50, 100, 250, 500] as const;

type Status = "idle" | "locating" | "loading" | "error";

export default function NearbySearch() {
  const t = useTranslations("nearby");
  const [radiusKm, setRadiusKm] = useState<number>(100);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [results, setResults] = useState<NearbyEarthquakeRow[]>([]);

  function handleSearch() {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMessage(t("geoNotSupported"));
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
        setErrorMessage(t("geoDenied"));
      }
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ds-text-secondary pb-2 border-b border-ds-border">
        <MorphIcon icon={MapPin} size={16} reducedMotion="user" className="text-indigo-400" />
        <span>{t("title")}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-ds-text-secondary">{t("radiusLabel")}</span>
        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="bg-ds-surface-elevated border border-ds-border rounded-ds-lg px-2 py-1 text-ds-text-primary flex-1"
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
        className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-ds-xl transition"
      >
        {(status === "locating" || status === "loading") && (
          <MorphIcon icon={Loader2} size={14} reducedMotion="user" className="animate-spin" />
        )}
        {status === "locating" ? t("locating") : status === "loading" ? t("loading") : t("useLocation")}
      </button>

      {status === "error" && (
        <div className="flex items-start gap-1.5 text-[11px] text-rose-400">
          <MorphIcon icon={AlertTriangle} size={14} reducedMotion="user" className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
          <p className="text-ds-text-secondary">
            {results.length} {t("resultsFound")}
          </p>
          {results.map((eq) => (
            <div key={eq.id} className="bg-ds-surface-elevated/60 rounded-ds-lg px-2 py-1.5 flex justify-between gap-2">
              <span className="text-ds-text-primary truncate">{eq.place}</span>
              <span className="text-amber-400 font-semibold shrink-0">M {eq.magnitude ?? "N/D"}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
