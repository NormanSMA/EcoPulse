'use client';

import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Info, Send } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/LayerToggle";
import type { usePushAlerts, PushPrefs } from "@/lib/usePushAlerts";

export type PushApi = ReturnType<typeof usePushAlerts>;

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4">
      <span className="text-sm text-ds-text-primary">{label}</span>
      <Switch checked={checked} label={label} onChange={onChange} />
    </div>
  );
}

/** Contenido del panel de alertas push (popover en escritorio, hoja en móvil). */
export default function AlertsPanel({ push }: { push: PushApi }) {
  const t = useTranslations("alerts");
  const { status, prefs, busy, error, enable, disable, setPrefs, sendTest } = push;
  const patch = (p: Partial<PushPrefs>) => void setPrefs({ ...prefs, ...p });
  const stateIcon = status === "on" ? BellRing : status === "denied" || status === "unsupported" ? BellOff : Bell;

  return (
    <div className="flex flex-col gap-2 py-3">
      <p className="flex items-center gap-3 px-4 text-sm text-ds-text-secondary">
        <MorphIcon icon={stateIcon} size={18} reducedMotion="user" className="shrink-0" />
        <span>{t(`status.${status}`)}</span>
      </p>

      {(status === "off" || status === "on") && (
        <div className="px-4">
          <Button
            variant={status === "on" ? "outlined" : "filled"}
            loading={busy}
            onClick={() => void (status === "on" ? disable() : enable())}
            className="w-full"
          >
            {status === "on" ? t("disable") : t("enable")}
          </Button>
        </div>
      )}

      {(status === "off" || status === "on") && (
        <>
          <div className="flex flex-col gap-1 px-4 pt-2">
            <label htmlFor="alerts-mag" className="flex items-center justify-between text-sm text-ds-text-primary">
              <span>{t("minMagnitude")}</span>
              <span className="font-medium text-ds-primary">M {prefs.minMagnitude.toFixed(1)}</span>
            </label>
            <input
              id="alerts-mag"
              type="range"
              min={4.5}
              max={8}
              step={0.5}
              value={prefs.minMagnitude}
              onChange={(e) => patch({ minMagnitude: Number(e.target.value) })}
              className="w-full accent-ds-primary"
            />
          </div>
          <Row label={t("cyclones")} checked={prefs.cyclones} onChange={(v) => patch({ cyclones: v })} />
          <Row label={t("volcanoes")} checked={prefs.volcanoes} onChange={(v) => patch({ volcanoes: v })} />
          <Row label={t("disasters")} checked={prefs.disasters} onChange={(v) => patch({ disasters: v })} />
        </>
      )}

      {status === "on" && (
        <div className="px-4">
          <Button variant="tonal" size="sm" onClick={() => void sendTest(t("testTitle"), t("testBody"))}>
            <MorphIcon icon={Send} size={16} reducedMotion="user" />
            {t("test")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="px-4 text-xs text-ds-error">
          {t("error")}
        </p>
      )}

      <p className="flex items-start gap-2 border-t border-ds-outline-variant px-4 pt-3 text-xs text-ds-text-muted">
        <MorphIcon icon={Info} size={14} reducedMotion="user" className="mt-px shrink-0" />
        <span>{t("iphoneNote")}</span>
      </p>
    </div>
  );
}
