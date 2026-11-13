"use client";

import { useCallback, useEffect, useId, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { GridForecastResponse } from "@/app/api/forecast/grid/route";
import { Button } from "@/components/ui/Button";
import { downloadFile, exportPack } from "@/lib/export";
import {
  deletePack,
  getPack,
  isExpired,
  listPacks,
  requestPersistence,
  savePack,
  storageEstimate,
} from "@/lib/offline/packRepo";
import { buildPack, type LiveEvents } from "@/lib/zones/buildPack";
import { countryZone, metroZone, tacticalZone } from "@/lib/zones/grid";
import type { ExportFormat, ZonePack, ZonePackMeta, ZoneSpec, ZoneTier } from "@/lib/zones/types";

export interface ZonePanelProps {
  locale: "es" | "en";
  online: boolean;
  /** Centro propuesto. name null indica el centro del mapa. */
  center: { lon: number; lat: number; name: string | null };
  events: LiveEvents;
  activeZoneId: string | null;
  onShow: (pack: ZonePack | null) => void;
}

const TIERS = [
  { value: "tactical", label: "tierTactical" },
  { value: "metro", label: "tierMetro" },
  { value: "country", label: "tierCountry" },
] as const;

const EXPORTS = [
  { format: "json", label: "exportJson" },
  { format: "csv", label: "exportCsv" },
  { format: "report", label: "exportReport" },
] as const;

const ACTION_CLASS =
  "min-h-11 min-w-11 max-w-full whitespace-normal break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary motion-reduce:transition-none motion-reduce:[&>span]:animate-none";

type Action = "download" | "refresh" | "show" | "delete" | ExportFormat;

export function ZonePanel({ locale, online, center, events, activeZoneId, onShow }: ZonePanelProps): JSX.Element {
  const t = useTranslations("zones");
  const titleId = useId();
  const savedId = useId();
  const [tier, setTier] = useState<ZoneTier>("tactical");
  const [packs, setPacks] = useState<ZonePackMeta[]>([]);
  const [storage, setStorage] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const lifetime = useRef<object | null>(null);
  const busy = useRef(false);
  const listVersion = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const display = useRef({ activeZoneId, onShow });

  useEffect(() => {
    display.current = { activeZoneId, onShow };
  }, [activeZoneId, onShow]);

  const reload = useCallback(async (isCurrent: () => boolean) => {
    const version = ++listVersion.current;
    const [metas, estimate] = await Promise.all([listPacks(), storageEstimate()]);
    if (!isCurrent() || version !== listVersion.current) return;
    setPacks(metas);
    setStorage(estimate?.usedBytes ?? null);
  }, []);

  useEffect(() => {
    const token = {};
    lifetime.current = token;
    const isCurrent = () => lifetime.current === token;
    void reload(isCurrent).catch(() => {
      if (isCurrent()) setError(true);
    });
    return () => {
      lifetime.current = null;
      controller.current?.abort();
      busy.current = false;
    };
  }, [reload]);

  const zone = tier === "country"
    ? countryZone()
    : tier === "metro"
      ? metroZone(center.lon, center.lat, center.name ?? undefined)
      : tacticalZone(center.lon, center.lat, center.name ?? undefined);

  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  const size = (bytes: number) => bytes >= 1024 * 1024
    ? `${numbers.format(bytes / (1024 * 1024))} MB`
    : `${numbers.format(bytes / 1024)} KB`;

  async function runAction(
    id: string,
    action: Action,
    work: (isCurrent: () => boolean) => Promise<void>,
  ): Promise<void> {
    const token = lifetime.current;
    if (!token || busy.current) return;
    const isCurrent = () => lifetime.current === token;
    busy.current = true;
    setPending({ id, action });
    setError(false);
    try {
      await work(isCurrent);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) {
        busy.current = false;
        controller.current = null;
        setPending(null);
      }
    }
  }

  async function download(target: ZoneSpec, isCurrent: () => boolean): Promise<void> {
    if (!online) return;
    const abort = new AbortController();
    controller.current = abort;
    const response = await fetch(`/api/forecast/grid?zone=${encodeURIComponent(target.id)}`, {
      signal: abort.signal,
    });
    if (!isCurrent()) return;
    if (!response.ok) throw new Error("forecast/grid");
    const data: GridForecastResponse = await response.json();
    if (!isCurrent()) return;
    const pack = buildPack(data.zone, data.forecast, events, { now: Date.now(), locale });
    const saved = await savePack(pack);
    if (!isCurrent()) return;
    if (!saved) throw new Error("savePack");
    void requestPersistence().catch(() => {});
    await reload(isCurrent);
    if (isCurrent() && display.current.activeZoneId === target.id) display.current.onShow(pack);
  }

  function toggle(meta: ZonePackMeta): void {
    void runAction(meta.id, "show", async (isCurrent) => {
      if (display.current.activeZoneId === meta.id) {
        display.current.onShow(null);
        return;
      }
      const pack = await getPack(meta.id);
      if (!isCurrent()) return;
      if (!pack) throw new Error("getPack");
      display.current.onShow(pack);
    });
  }

  function remove(meta: ZonePackMeta): void {
    void runAction(meta.id, "delete", async (isCurrent) => {
      const deleted = await deletePack(meta.id);
      if (!isCurrent()) return;
      if (!deleted) throw new Error("deletePack");
      if (display.current.activeZoneId === meta.id) display.current.onShow(null);
      await reload(isCurrent);
    });
  }

  function exportZone(meta: ZonePackMeta, format: ExportFormat): void {
    void runAction(meta.id, format, async (isCurrent) => {
      const pack = await getPack(meta.id);
      if (!isCurrent()) return;
      if (!pack) throw new Error("getPack");
      for (const file of exportPack(pack, format, locale)) downloadFile(file);
    });
  }

  const loading = (id: string, action: Action) => pending?.id === id && pending.action === action;

  return (
    <div aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4 text-sm text-ds-text-primary">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 id={titleId} className="ds-eyebrow">{t("title")}</h3>
        <p className="text-ds-text-secondary">{t("intro")}</p>
      </div>

      <div role="radiogroup" aria-label={t("tierLabel")} className="flex min-w-0 flex-col gap-2">
        <span className="ds-eyebrow">{t("tierLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((option, index) => (
            <Button
              key={option.value}
              ref={(node) => { radios.current[index] = node; }}
              role="radio"
              aria-checked={tier === option.value}
              tabIndex={tier === option.value ? 0 : -1}
              variant={tier === option.value ? "tonal" : "outlined"}
              className={ACTION_CLASS}
              onClick={() => setTier(option.value)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const next = (index + (event.key === "ArrowRight" ? 1 : -1) + TIERS.length) % TIERS.length;
                setTier(TIERS[next].value);
                radios.current[next]?.focus();
              }}
            >
              {t(option.label)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-ds-card border border-ds-divider bg-white/[0.04] p-3">
        {tier !== "country" && (
          <p className="break-words text-xs text-ds-text-secondary">
            {t("center", { place: center.name ?? t("mapCenter") })}
          </p>
        )}
        <p className="break-words font-medium">{zone.name}</p>
        <Button
          className={ACTION_CLASS}
          disabled={!online || pending !== null}
          loading={pending?.action === "download"}
          onClick={() => { void runAction(zone.id, "download", (isCurrent) => download(zone, isCurrent)); }}
        >
          {pending?.action === "download" ? t("downloading") : t("download")}
        </Button>
        {!online && <p className="text-xs text-ds-text-secondary">{t("offlineHint")}</p>}
        {error && <p role="alert" className="text-ds-warning">{t("error")}</p>}
      </div>

      <div aria-labelledby={savedId} className="flex min-w-0 flex-col gap-3">
        <h4 id={savedId} className="ds-eyebrow">{t("saved")}</h4>
        {packs.length === 0 ? <p className="text-ds-text-secondary">{t("empty")}</p> : (
          <ul className="flex min-w-0 flex-col gap-4">
            {packs.map((meta) => (
              <li key={meta.id} className="flex min-w-0 flex-col gap-2 border-t border-ds-divider pt-3">
                <p className="break-words font-medium">{meta.zone.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ds-text-secondary">
                  <span>{t("points", { count: meta.pointCount })}</span>
                  <span>{t("events", { count: meta.eventCount })}</span>
                  <span>{size(meta.sizeBytes)}</span>
                </div>
                {isExpired(meta, Date.now()) ? (
                  <span className="self-start rounded-ds-full border border-ds-warning px-2 py-1 text-xs text-ds-warning">
                    {t("expired")}
                  </span>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p role="status" className="flex items-center gap-2 text-xs text-ds-success">
                      <span aria-hidden="true" className="ds-glow h-2 w-2 rounded-full bg-ds-success [--ep-accent:rgb(var(--ds-success))]" />
                      {t("readyOffline")}
                    </p>
                    <p className="text-xs text-ds-text-secondary">{t("validUntil", { date: dates.format(meta.validUntil) })}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="tonal"
                    className={ACTION_CLASS}
                    disabled={pending !== null}
                    loading={loading(meta.id, "show")}
                    onClick={() => toggle(meta)}
                  >
                    {t(activeZoneId === meta.id ? "hide" : "show")}
                  </Button>
                  <Button
                    variant="outlined"
                    className={ACTION_CLASS}
                    disabled={!online || pending !== null}
                    loading={loading(meta.id, "refresh")}
                    onClick={() => { void runAction(meta.id, "refresh", (isCurrent) => download(meta.zone, isCurrent)); }}
                  >
                    {loading(meta.id, "refresh") ? t("downloading") : t("refresh")}
                  </Button>
                  <Button
                    variant="text"
                    className={ACTION_CLASS}
                    disabled={pending !== null}
                    loading={loading(meta.id, "delete")}
                    onClick={() => remove(meta)}
                  >
                    {t("delete")}
                  </Button>
                </div>
                <div role="group" aria-label={t("export")} className="flex flex-wrap gap-2">
                  {EXPORTS.map(({ format, label }) => (
                    <Button
                      key={format}
                      variant="outlined"
                      className={ACTION_CLASS}
                      disabled={pending !== null}
                      loading={loading(meta.id, format)}
                      onClick={() => exportZone(meta, format)}
                    >
                      {t(label)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {storage !== null && <p className="text-xs text-ds-text-secondary">{t("storage", { used: size(storage) })}</p>}
    </div>
  );
}
