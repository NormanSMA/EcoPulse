import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseFirmsCsv,
  toAcquiredAtIso,
  toFireFeature,
  isSignificantFire,
  fetchLiveFires,
} from "./firms";

const SAMPLE_CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
12.4321,-85.9876,345.8,0.57,0.52,2026-09-06,1345,N20,VIIRS,h,2.0NRT,275.04,42.7,D
13.1000,-86.2000,320.1,0.4,0.4,2026-09-06,1200,N20,VIIRS,l,2.0NRT,270.0,3.2,D
14.5000,-87.1000,330.0,0.5,0.5,2026-09-06,1250,N20,VIIRS,n,2.0NRT,272.0,8.5,N
15.0000,-88.0000,400.0,0.6,0.6,2026-09-06,1300,N20,VIIRS,h,2.0NRT,280.0,5.0,D`;

describe("parseFirmsCsv", () => {
  it("parsea todas las filas validas del CSV", () => {
    const rows = parseFirmsCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      latitude: 12.4321,
      longitude: -85.9876,
      brightness: 345.8,
      frp: 42.7,
      confidence: "high",
      satellite: "N20",
      acq_date: "2026-09-06",
      acq_time: "1345",
    });
  });

  it("mapea los codigos de confianza de una letra a la palabra completa", () => {
    const rows = parseFirmsCsv(SAMPLE_CSV);
    expect(rows.map((r) => r.confidence)).toEqual(["high", "low", "nominal", "high"]);
  });

  it("devuelve arreglo vacio si el CSV solo tiene encabezado", () => {
    expect(parseFirmsCsv("latitude,longitude,confidence")).toEqual([]);
  });
});

describe("isSignificantFire", () => {
  it("solo pasa incendios de confianza alta y FRP >= 10", () => {
    const rows = parseFirmsCsv(SAMPLE_CSV);
    const significant = rows.filter(isSignificantFire);
    expect(significant).toHaveLength(1);
    expect(significant[0].frp).toBe(42.7);
  });
});

describe("toAcquiredAtIso", () => {
  it("convierte fecha y hora acq (HHMM) a ISO 8601", () => {
    expect(toAcquiredAtIso("2026-09-06", "1345")).toBe("2026-09-06T13:45:00.000Z");
  });

  it("rellena con ceros las horas cortas", () => {
    expect(toAcquiredAtIso("2026-09-06", "5")).toBe("2026-09-06T00:05:00.000Z");
  });
});

describe("toFireFeature", () => {
  it("construye una feature GeoJSON con un fireKey deterministico", () => {
    const rows = parseFirmsCsv(SAMPLE_CSV);
    const feature = toFireFeature(rows[0]);
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.coordinates).toEqual([-85.9876, 12.4321]);
    expect(feature.properties.fireKey).toBe("12.432_-85.988_2026-09-06_1345_N20");
    expect(feature.id).toBe(feature.properties.fireKey);
  });
});

describe("fetchLiveFires", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("devuelve vacio si no hay NASA_FIRMS_MAP_KEY configurada", async () => {
    vi.stubEnv("NASA_FIRMS_MAP_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchLiveFires();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.features).toEqual([]);
  });

  it("filtra solo incendios significativos del CSV real", async () => {
    vi.stubEnv("NASA_FIRMS_MAP_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_CSV }));

    const result = await fetchLiveFires();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.confidence).toBe("high");
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubEnv("NASA_FIRMS_MAP_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await fetchLiveFires();
    expect(result.features).toEqual([]);
  });
});
