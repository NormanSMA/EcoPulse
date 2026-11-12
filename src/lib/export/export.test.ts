import { describe, expect, it } from "vitest";
import type { ZonePack } from "../zones/types";
import { csvCell, escapeHtml, exportPack, toCsv, toJson, toReport } from "./index";

const T0 = Date.UTC(2026, 0, 2, 3, 4);
const HOURS = 4;
const EVIL_ZONE = `<img src=x onerror=alert(1)>"'&`;

function makePack(): ZonePack {
  const time = Array.from({ length: HOURS }, (_, i) => T0 + i * 3_600_000);
  const nums = time.map((_, i) => i);
  const weather = () => ({
    temperature: nums.map((n) => 20 + n),
    apparentTemperature: nums,
    humidity: nums,
    surfacePressure: nums,
    cloudCover: nums,
    precipitationProbability: [null, 10, 20, 30],
    precipitation: nums.map((n) => n / 2),
    windSpeed: nums,
    windDirection: nums,
    windGusts: nums.map((n) => n + 5),
    uvIndex: [null, 1, 2, 3],
    weatherCode: nums,
    isDay: time.map(() => true),
  });
  return {
    meta: {
      id: "tactical:12.1,-86.2",
      zone: { id: "tactical:12.1,-86.2", tier: "tactical", name: EVIL_ZONE, bbox: [-87, 12, -86, 13], center: [-86.2, 12.1], stepDeg: 0.25, maxPoints: 10 },
      version: 1,
      createdAt: T0,
      validFrom: T0,
      validUntil: T0 + 3 * 3_600_000,
      horizonHours: 72,
      pointCount: 2,
      eventCount: 3,
      sizeBytes: 1,
      locale: "es",
    },
    forecast: {
      points: [
        { id: "p1", lon: -86.2, lat: 12.1, label: "=HYPERLINK(1)", anchor: true },
        { id: "p2", lon: -86.0, lat: 12.1 },
      ],
      time,
      weather: [weather(), weather()],
      air: [{ pm25: [1, null, 3, 4], pm10: nums, usAqi: nums }, null],
      meta: { generatedAt: T0, horizonHours: 72, utcOffsetSeconds: 0, models: { weather: "open-meteo", air: "open-meteo-cams" }, source: "network" },
    },
    events: {
      capturedAt: T0,
      earthquakes: [
        {
          type: "Feature",
          id: "eq1",
          properties: { mag: 4.5, place: "</td><script>alert(1)</script>", time: T0, updated: T0, url: "javascript:alert(1)", alert: null, status: "x", tsunami: 0, sig: 1 },
          geometry: { type: "Point", coordinates: [-86.1, 12.2, 10] },
        },
        {
          type: "Feature",
          id: "eq2",
          properties: { mag: 3, place: "Managua, NI", time: T0, updated: T0, url: "https://example.com/eq2", alert: null, status: "x", tsunami: 0, sig: 1 },
          geometry: { type: "Point", coordinates: [-86.3, 12.0, 5] },
        },
      ],
      fires: [],
      disasters: [],
      cyclones: [],
      volcanoes: [],
    },
  };
}

describe("csvCell", () => {
  it("entrecomilla y duplica comillas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
    expect(csvCell(null)).toBe("");
  });
  it("neutraliza fórmulas pero no números", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("genera filas por punto y hora", () => {
    const [forecast, events] = toCsv(makePack());
    expect(forecast.content.startsWith("﻿")).toBe(true);
    const lines = forecast.content.slice(1).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1 + 2 * HOURS);
    expect(lines[0].split(",")).toHaveLength(20);
    expect(lines[1]).toContain("'=HYPERLINK(1)");
    expect(events.filename).toMatch(/^ecopulse-tactical-12-1-86-2-20260102-0304-events\.csv$/);
    expect(events.content.slice(1).split("\r\n").filter(Boolean)).toHaveLength(3);
  });
});

describe("toJson", () => {
  it("se puede volver a parsear", () => {
    const pack = makePack();
    const file = toJson(pack);
    expect(file.mime).toBe("application/json");
    expect(JSON.parse(file.content)).toEqual(pack);
  });
});

describe("toReport", () => {
  it("escapa contenido del paquete", () => {
    const { content } = toReport(makePack(), "es");
    expect(content).not.toContain("<script");
    expect(content).not.toContain("<img");
    expect(content).not.toMatch(/onerror=alert\(1\)>/);
    expect(content).toContain("&lt;script&gt;");
    expect(content).not.toContain("http://");
    expect(content).not.toContain('src="http');
    expect(content).not.toContain("javascript:");
    expect(content).toContain('href="https://example.com/eq2"');
    expect(content).toContain('rel="noopener noreferrer"');
    expect(content).toContain("<svg");
  });
  it("escapeHtml respeta el orden", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
  it("exportPack despacha por formato", () => {
    const pack = makePack();
    expect(exportPack(pack, "json", "en")).toHaveLength(1);
    expect(exportPack(pack, "csv", "en")).toHaveLength(2);
    expect(exportPack(pack, "report", "en")[0].mime).toBe("text/html");
  });
});
