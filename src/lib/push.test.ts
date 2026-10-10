import { describe, it, expect } from "vitest";
import { validateSubscription, isPushServiceHost, collectCandidateEvents, matchesPrefs, normalizePrefs, type PushSources } from "./push";
import type { EarthquakeFeature, CycloneFeature, ActiveVolcanoFeature, DisasterFeature } from "./types";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const valid = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "pk", auth: "au" } };

function quake(id: string, mag: number | null, ageMin: number): EarthquakeFeature {
  return {
    type: "Feature",
    id,
    properties: { mag, place: "30 km SW of X", time: NOW - ageMin * 60_000, updated: NOW, url: "", alert: null, status: "", tsunami: 0, sig: 0 },
    geometry: { type: "Point", coordinates: [0, 0, 10] },
  };
}

function disaster(id: string, type: "FL" | "TC", level: "Green" | "Orange" | "Red", ageH: number): DisasterFeature {
  return {
    type: "Feature",
    id,
    properties: {
      eventId: id, eventType: type, eventTypeLabel: "Inundación", name: "N", country: "C", alertLevel: level,
      fromDate: new Date(NOW - ageH * 3_600_000).toISOString(), toDate: null, reportUrl: "",
    },
    geometry: { type: "Point", coordinates: [0, 0] },
  };
}

const empty: PushSources = { quakes: [], cyclones: [], volcanoes: [], disasters: [], appUrl: "https://app.test/" };

describe("validateSubscription", () => {
  it("aplica valores por defecto", () => {
    const s = validateSubscription(valid);
    expect(s?.prefs).toEqual({ minMagnitude: 6, cyclones: true, volcanoes: true, disasters: true });
    expect(s?.locale).toBe("es");
  });
  it("rechaza endpoint http, sin keys y locale invalido", () => {
    expect(validateSubscription({ ...valid, endpoint: "http://x.com" })).toBeNull();
    expect(validateSubscription({ endpoint: valid.endpoint })).toBeNull();
    expect(validateSubscription({ ...valid, locale: "fr" })).toBeNull();
    expect(validateSubscription(null)).toBeNull();
  });
  it("acota minMagnitude y acepta en", () => {
    expect(normalizePrefs({ minMagnitude: 2 }).minMagnitude).toBe(4.5);
    expect(normalizePrefs({ minMagnitude: 12 }).minMagnitude).toBe(9);
    expect(validateSubscription({ ...valid, locale: "en" })?.locale).toBe("en");
  });
});

describe("collectCandidateEvents", () => {
  it("incluye sismos de las ultimas 2 h con textos es/en", () => {
    const ev = collectCandidateEvents({ ...empty, quakes: [quake("a", 6.4, 5), quake("b", 6.4, 180), quake("c", null, 1)] }, NOW);
    expect(ev).toHaveLength(1);
    expect(ev[0].title.es).toBe("Sismo M 6.4 · 30 km SW of X");
    expect(ev[0].body.es).toBe("Profundidad 10 km · hace 5 min");
    expect(ev[0].body.en).toBe("Depth 10 km · 5 min ago");
    expect(ev[0].url).toBe("https://app.test/?sel=eq-a");
  });
  it("incluye volcanes new y desastres Orange/Red no TC", () => {
    const volcano = (status: "new" | "continuing"): ActiveVolcanoFeature => ({
      type: "Feature", id: 1,
      properties: { name: "V", country: "C", period: "P", status, summary: "", sources: null, reportUrl: "", published: null },
      geometry: { type: "Point", coordinates: [0, 0] },
    });
    const ev = collectCandidateEvents(
      { ...empty, volcanoes: [volcano("new"), volcano("continuing")], disasters: [disaster("FL-1", "FL", "Red", 1), disaster("FL-2", "FL", "Green", 1), disaster("TC-3", "TC", "Red", 1), disaster("FL-4", "FL", "Red", 100)] },
      NOW
    );
    expect(ev.map((e) => e.kind).sort()).toEqual(["disaster", "volcano"]);
  });
  it("un evento por ciclon", () => {
    const pos = (kind: "position" | "track"): CycloneFeature => ({
      type: "Feature",
      properties: { eventId: "9", name: "Ida", alertLevel: "Red", kind },
      geometry: { type: "Point", coordinates: [0, 0] },
    });
    const ev = collectCandidateEvents({ ...empty, cyclones: [pos("track"), pos("position"), pos("position")] }, NOW);
    expect(ev).toHaveLength(1);
    expect(ev[0].key).toBe("cyclone-9");
  });
});

describe("matchesPrefs", () => {
  const prefs = normalizePrefs({ cyclones: false });
  it("filtra por magnitud y tipo", () => {
    const [q] = collectCandidateEvents({ ...empty, quakes: [quake("a", 5.5, 1)] }, NOW);
    expect(matchesPrefs(q, prefs)).toBe(false);
    expect(matchesPrefs(q, { ...prefs, minMagnitude: 5 })).toBe(true);
    expect(matchesPrefs({ ...q, kind: "cyclone" }, prefs)).toBe(false);
    expect(matchesPrefs({ ...q, kind: "volcano" }, prefs)).toBe(true);
  });
});

describe("isPushServiceHost", () => {
  it("acepta servicios de push reales y rechaza otros dominios", () => {
    expect(isPushServiceHost("fcm.googleapis.com")).toBe(true);
    expect(isPushServiceHost("updates.push.services.mozilla.com")).toBe(true);
    expect(isPushServiceHost("web.push.apple.com")).toBe(true);
    expect(isPushServiceHost("db5p.notify.windows.com")).toBe(true);
    expect(isPushServiceHost("evil.example.com")).toBe(false);
    expect(isPushServiceHost("fcm.googleapis.com.evil.io")).toBe(false);
  });
});
