import { describe, expect, it } from "vitest";
import {
  FORECAST_WINDOWS, HOUR_MS, globalMode, isForecastWindow, stopGroup, playbackEnded, playbackStart, playbackStep, resolveTimeline, seekTime, type TimeWindow,
} from "./timeline";

const NOW = 1_800_000_000_000;
const TABLE: Record<string, number | undefined> = { live: undefined, "1h": HOUR_MS, "6h": 6 * HOUR_MS, "24h": 24 * HOUR_MS, "7d": 168 * HOUR_MS };

// Formula original de page.tsx.
function legacy(window: string, customStart: number | null, playhead: number | null, now: number) {
  const windowMs = window === "custom" ? now - (customStart ?? now) : TABLE[window] ?? null;
  const span = Math.max(windowMs ?? TABLE["24h"]!, HOUR_MS / 4);
  return {
    windowMs,
    span,
    refTime: playhead ?? now,
    rangeStart: window === "custom" && customStart != null ? customStart : windowMs != null || playhead != null ? now - span : -Infinity,
    rangeEnd: playhead ?? Infinity,
    playProgress: playhead != null ? (playhead - (now - span)) / span : null,
    usesWeek: window === "7d" || window === "custom",
    needWeek: window === "7d" || (window === "custom" && customStart != null && customStart < now - 24 * HOUR_MS),
  };
}

describe("ventanas pasadas igualan la formula actual", () => {
  const cases: [TimeWindow, number | null, number | null][] = [];
  for (const w of ["live", "1h", "6h", "24h", "7d"] as const) for (const p of [null, NOW - 1000]) cases.push([w, null, p]);
  for (const cs of [null, NOW - 2 * 24 * HOUR_MS, NOW - 5 * 60_000]) for (const p of [null, NOW - 1000]) cases.push(["custom", cs, p]);

  it.each(cases)("%s customStart=%s playhead=%s", (window, customStart, playhead) => {
    const tl = resolveTimeline({ window, customStart, playhead, now: NOW });
    expect(tl).toMatchObject(legacy(window, customStart, playhead, NOW));
    expect(tl.spanStart).toBe(NOW - tl.span);
    expect(tl.horizonHours).toBe(0);
  });

  it("modo live o past", () => {
    expect(resolveTimeline({ window: "live", customStart: null, playhead: null, now: NOW }).mode).toBe("live");
    expect(resolveTimeline({ window: "6h", customStart: null, playhead: null, now: NOW }).mode).toBe("past");
  });
});

describe("forecast", () => {
  it.each([["+24h", 24], ["+48h", 48], ["+72h", 72]] as const)("%s", (window, hours) => {
    const tl = resolveTimeline({ window, customStart: null, playhead: NOW + HOUR_MS, now: NOW });
    expect(tl).toMatchObject({
      mode: "forecast", horizonHours: hours, span: hours * HOUR_MS, windowMs: hours * HOUR_MS, spanStart: NOW,
      refTime: NOW + HOUR_MS, usesWeek: false, needWeek: false,
    });
    expect(tl.playProgress).toBeCloseTo(1 / hours);
  });

  it("rango infinito aunque haya playhead", () => {
    for (const playhead of [null, NOW + 5 * HOUR_MS]) {
      const tl = resolveTimeline({ window: "+24h", customStart: null, playhead, now: NOW });
      expect(tl.rangeStart).toBe(-Infinity);
      expect(tl.rangeEnd).toBe(Infinity);
    }
    expect(resolveTimeline({ window: "+24h", customStart: null, playhead: null, now: NOW }).playProgress).toBeNull();
  });

  it("isForecastWindow", () => {
    expect(FORECAST_WINDOWS.every((w) => isForecastWindow(w))).toBe(true);
    expect(isForecastWindow("24h")).toBe(false);
    expect(isForecastWindow("live")).toBe(false);
  });
});

describe("reproduccion", () => {
  const past = resolveTimeline({ window: "6h", customStart: null, playhead: null, now: NOW });
  const fc = resolveTimeline({ window: "+48h", customStart: null, playhead: null, now: NOW });

  it("playbackStart es spanStart", () => {
    expect(playbackStart(past)).toBe(NOW - 6 * HOUR_MS);
    expect(playbackStart(fc)).toBe(NOW);
  });
  it("playbackStep", () => {
    expect(playbackStep(past, 100, 2, 20_000)).toBe((6 * HOUR_MS * 100 * 2) / 20_000);
  });
  it("playbackEnded", () => {
    expect(playbackEnded(null, past, NOW)).toBe(false);
    expect(playbackEnded(NOW - 1, past, NOW)).toBe(false);
    expect(playbackEnded(NOW, past, NOW)).toBe(true);
    expect(playbackEnded(NOW + HOUR_MS, fc, NOW)).toBe(false);
    expect(playbackEnded(NOW + 48 * HOUR_MS, fc, NOW)).toBe(true);
  });
  it("seekTime", () => {
    expect(seekTime(0.5, past, NOW)).toBe(NOW - 3 * HOUR_MS);
    expect(seekTime(1, past, NOW)).toBe(NOW - 1);
    expect(seekTime(0.5, fc, NOW)).toBe(NOW + 24 * HOUR_MS);
    expect(seekTime(2, fc, NOW)).toBe(NOW + 48 * HOUR_MS);
    expect(seekTime(-1, fc, NOW)).toBe(NOW);
  });
});

describe("globalMode", () => {
  it("prioriza sin conexion", () => {
    expect(globalMode({ online: false, window: "+24h" })).toBe("offline");
    expect(globalMode({ online: false, window: "live" })).toBe("offline");
  });
  it("distingue pronostico, historial y en vivo", () => {
    expect(globalMode({ online: true, window: "+48h" })).toBe("forecast");
    expect(globalMode({ online: true, window: "24h" })).toBe("history");
    expect(globalMode({ online: true, window: "custom" })).toBe("history");
    expect(globalMode({ online: true, window: "live", playing: true })).toBe("history");
    expect(globalMode({ online: true, window: "live" })).toBe("live");
  });
});

describe("stopGroup", () => {
  it("agrupa las 8 paradas en tres grupos", () => {
    const all: TimeWindow[] = ["7d", "24h", "6h", "1h", "custom", "live", "+24h", "+48h", "+72h"];
    expect(all.map(stopGroup)).toEqual(["past", "past", "past", "past", "past", "live", "forecast", "forecast", "forecast"]);
  });
});
