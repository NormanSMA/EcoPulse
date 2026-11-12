import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActiveVolcanoes, loadActiveVolcanoes, parseWeeklyRss, parseWeeklyTitle, repairText } from "./gvpWeekly";

// Fixture: feed real del Weekly Volcanic Activity Report (17/09/2026).
const xml = readFileSync(join(__dirname, "__fixtures__", "gvp-weekly.xml"), "latin1");

describe("parseWeeklyTitle", () => {
  it("separa nombre, país, periodo y estado", () => {
    expect(parseWeeklyTitle("Krakatau (Indonesia) - Report for 10 September-16 September 2026 - New Eruptive Activity")).toEqual({
      name: "Krakatau",
      country: "Indonesia",
      period: "10 September-16 September 2026",
      isNew: true,
    });
  });
});

describe("parseWeeklyRss", () => {
  const features = parseWeeklyRss(xml);

  it("extrae todos los volcanes con coordenadas válidas", () => {
    expect(features.length).toBe(20);
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    }
  });

  it("limpia el HTML del reporte y separa las fuentes", () => {
    const k = features.find((f) => f.properties.name === "Krakatau")!;
    expect(k.properties.status).toBe("new");
    expect(k.properties.summary).not.toMatch(/<|&lt;/);
    expect(k.properties.summary).toMatch(/Strombolian/);
    expect(k.properties.sources).toMatch(/PVMBG/);
    expect(k.properties.reportUrl).toBe("https://volcano.si.edu/volcano.cfm?vn=262000");
  });
});

describe("repairText", () => {
  it("restaura apóstrofos y subíndices perdidos en origen", () => {
    expect(repairText("del Perú?s (IGP)")).toBe("del Perú’s (IGP)");
    expect(repairText("sulfur dioxide (SO?) emissions")).toBe("sulfur dioxide (SO₂) emissions");
    expect(repairText("Kilauea?s Kaluapele")).toBe("Kilauea’s Kaluapele");
  });

  it("no toca signos de interrogación legítimos", () => {
    expect(repairText("Is it erupting? Yes.")).toBe("Is it erupting? Yes.");
  });
});

describe("loadActiveVolcanoes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza con HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadActiveVolcanoes()).rejects.toThrow("GVP weekly HTTP 500");
  });

  it("lanza cuando fetch rechaza", async () => {
    const error = new TypeError("sin red");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadActiveVolcanoes()).rejects.toBe(error);
  });

  it("conserva la tolerancia del envoltorio ante fallos de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("sin red")));
    await expect(fetchActiveVolcanoes()).resolves.toEqual({ type: "FeatureCollection", features: [] });
  });

  it("relanza AbortError en el cargador y el envoltorio", async () => {
    const error = new DOMException("cancelado", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadActiveVolcanoes()).rejects.toBe(error);
    await expect(fetchActiveVolcanoes()).rejects.toBe(error);
  });
});
