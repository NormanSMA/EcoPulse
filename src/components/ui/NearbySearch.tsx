'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed, AlertTriangle, Check } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Button } from "@/components/ui/Button";
import { magnitudeColor } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";
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

  const busy = status === "locating" || status === "loading";

  return (
    <div className="flex flex-col gap-3 px-3">
      <div role="radiogroup" aria-label={t("radiusLabel")} className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-ds-text-secondary">{t("radiusLabel")}</span>
        {RADIUS_OPTIONS_KM.map((km) => {
          const active = km === radiusKm;
          return (
            <button
              key={km}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setRadiusKm(km)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-ds-md border px-3 text-[13px] font-medium transition-colors duration-ds-fast",
                active
                  ? "border-transparent bg-ds-secondary-container text-ds-secondary-on-container"
                  : "border-ds-outline-variant text-ds-text-secondary hover:bg-ds-hover"
              )}
            >
              {active && <MorphIcon icon={Check} size={14} reducedMotion="user" />}
              {km} km
            </button>
          );
        })}
      </div>

      <Button variant="tonal" onClick={handleSearch} loading={busy} className="w-full">
        {!busy && <MorphIcon icon={LocateFixed} size={18} reducedMotion="user" />}
        {status === "locating" ? t("locating") : status === "loading" ? t("loading") : t("useLocation")}
      </Button>

      {status === "error" && (
        <div role="alert" className="flex items-start gap-2 rounded-ds-control bg-ds-error/10 px-3 py-2 text-xs text-ds-error">
          <MorphIcon icon={AlertTriangle} size={16} reducedMotion="user" className="mt-px shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-ds-text-secondary">
            {results.length} {t("resultsFound")}
          </p>
          <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto overscroll-contain">
            {results.map((eq) => (
              <li key={eq.id} className="flex items-center justify-between gap-3 rounded-ds-control px-3 py-2 hover:bg-ds-hover">
                <span className="truncate text-sm text-ds-text-primary">{eq.place}</span>
                <span
                  className="shrink-0 rounded-ds-full px-2 py-0.5 text-xs font-medium tabular-nums"
                  style={{
                    color: magnitudeColor(eq.magnitude ?? 0),
                    backgroundColor: `${magnitudeColor(eq.magnitude ?? 0)}24`,
                  }}
                >
                  M {eq.magnitude ?? "N/D"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
