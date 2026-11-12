import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseOemFile,
  interpolateStateVector,
  gmstRadians,
  eciToGeodetic,
  fetchLiveIssPosition,
  loadIss,
  StateVector,
  computeEphemeris,
  issAt,
} from "./iss";
import type { IssFeature } from "./types";

const SAMPLE_OEM = `CCSDS_OEM_VERS = 2.0
CREATION_DATE  = 2026-09-04T15:27:50.688
ORIGINATOR     = NASA/JSC/FOD/TOPO

META_START
OBJECT_NAME          = ISS
META_STOP

COMMENT Source: This file was produced by the TOPO office within FOD at JSC.
2026-09-04T12:00:00.000 -304.795682412414 6745.236027492530 -796.410785972284 -4.76521816507237 -0.90540922548638 -5.92826400060074
2026-09-04T12:04:00.000 -1423.488290590500 6285.482216805200 -2172.856636368370 -4.50043078478934 -2.90197450114580 -5.47208146061657
2026-09-04T12:08:00.000 -2438.863598181990 5369.448268390270 -3391.155010956230 -3.90970023519297 -4.68461762364110 -4.61868118994434
`;

describe("parseOemFile", () => {
  it("extrae solo las lineas de vector de estado, ignorando metadata y comentarios", () => {
    const vectors = parseOemFile(SAMPLE_OEM);
    expect(vectors).toHaveLength(3);
    expect(vectors[0].timestamp.toISOString()).toBe("2026-09-04T12:00:00.000Z");
    expect(vectors[0].x).toBeCloseTo(-304.795682412414);
    expect(vectors[0].y).toBeCloseTo(6745.236027492530);
    expect(vectors[0].z).toBeCloseTo(-796.410785972284);
  });
});

describe("gmstRadians", () => {
  it("calcula un angulo GMST valido (0 a 2*PI) para una fecha real", () => {
    const gmst = gmstRadians(new Date("2026-09-04T12:00:00.000Z"));
    expect(gmst).toBeGreaterThanOrEqual(0);
    expect(gmst).toBeLessThan(2 * Math.PI);
  });
});

describe("eciToGeodetic", () => {
  it("convierte un vector ECI real a lat/lon/altitud plausibles para la ISS", () => {
    // Verificado independientemente con Python: lat -6.73, lon -71.04, alt 420.79 km
    const result = eciToGeodetic(
      -304.795682412414,
      6745.236027492530,
      -796.410785972284,
      new Date("2026-09-04T12:00:00.000Z")
    );
    expect(result.latitude).toBeCloseTo(-6.73, 1);
    expect(result.longitude).toBeCloseTo(-71.04, 1);
    expect(result.altitudeKm).toBeCloseTo(420.79, 1);
  });

  it("la altitud siempre esta en el rango orbital plausible de la ISS", () => {
    const result = eciToGeodetic(-1423.49, 6285.48, -2172.86, new Date("2026-09-04T12:04:00.000Z"));
    expect(result.altitudeKm).toBeGreaterThan(300);
    expect(result.altitudeKm).toBeLessThan(500);
  });
});

describe("interpolateStateVector", () => {
  const vectors = parseOemFile(SAMPLE_OEM);

  it("interpola sobre la órbita (Hermite) sin cortar la cuerda en el punto medio", () => {
    const at = new Date("2026-09-04T12:02:00.000Z"); // punto medio exacto
    const result = interpolateStateVector(vectors, at) as StateVector;
    const r = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
    const [a, b] = vectors;
    const linearMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    // La órbita es casi circular: el radio interpolado debe quedar a <2 km
    // del de las muestras, mientras que la interpolación lineal se hunde.
    expect(Math.abs(r(result) - r(a))).toBeLessThan(2);
    expect(r(a) - r(linearMid)).toBeGreaterThan(10);
  });

  it("devuelve la muestra exacta si el timestamp coincide", () => {
    const result = interpolateStateVector(vectors, new Date("2026-09-04T12:04:00.000Z")) as StateVector;
    expect(result.x).toBeCloseTo(-1423.488290590500, 5);
  });

  it("devuelve la primera muestra si el instante pedido es anterior a todas", () => {
    const result = interpolateStateVector(vectors, new Date("2020-01-01T00:00:00.000Z")) as StateVector;
    expect(result.timestamp.toISOString()).toBe(vectors[0].timestamp.toISOString());
  });

  it("devuelve null si no hay vectores", () => {
    expect(interpolateStateVector([], new Date())).toBeNull();
  });
});

describe("fetchLiveIssPosition", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve una feature con la posicion interpolada al momento actual", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:02:00.000Z"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_OEM }));

    const result = await fetchLiveIssPosition();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].id).toBe("iss");
    expect(result.features[0].properties.altitudeKm).toBeGreaterThan(300);
    vi.useRealTimers();
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchLiveIssPosition();
    expect(result.features).toEqual([]);
  });
});

describe("loadIss", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza si el archivo no contiene vectores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "META_START" }));
    await expect(loadIss()).rejects.toThrow("ISS OEM sin vectores");
    await expect(fetchLiveIssPosition()).resolves.toEqual({ type: "FeatureCollection", features: [] });
  });

  it("incluye efemérides desde el instante solicitado", async () => {
    const now = new Date("2026-09-04T12:02:00.000Z");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_OEM }));
    const result = await loadIss(undefined, now);
    expect(result.features[0].properties.ephemeris).toEqual(computeEphemeris(parseOemFile(SAMPLE_OEM), now));
  });

  it("lanza con HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadIss()).rejects.toThrow("ISS OEM HTTP 500");
  });

  it("lanza cuando fetch rechaza", async () => {
    const error = new TypeError("sin red");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadIss()).rejects.toBe(error);
  });

  it("conserva la tolerancia del envoltorio ante fallos de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("sin red")));
    await expect(fetchLiveIssPosition()).resolves.toEqual({ type: "FeatureCollection", features: [] });
  });

  it("relanza AbortError en el cargador y el envoltorio", async () => {
    const error = new DOMException("cancelado", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadIss()).rejects.toBe(error);
    await expect(fetchLiveIssPosition()).rejects.toBe(error);
  });
});

describe("computeEphemeris", () => {
  it("devuelve 121 puntos para 30 minutos con pasos de 15 segundos", () => {
    const from = new Date("2026-09-04T12:00:00.000Z");
    const ephemeris = computeEphemeris(parseOemFile(SAMPLE_OEM), from);
    expect(ephemeris.start).toBe(from.getTime());
    expect(ephemeris.stepSeconds).toBe(15);
    expect(ephemeris.points).toHaveLength(121);
  });
});

describe("issAt", () => {
  const start = Date.parse("2026-09-04T12:00:00.000Z");
  const feature: IssFeature = {
    type: "Feature",
    id: "iss",
    geometry: { type: "Point", coordinates: [10, 0] },
    properties: {
      altitudeKm: 400,
      velocityKmS: 7.6,
      timestamp: new Date(start).toISOString(),
      ephemeris: { start, stepSeconds: 15, points: [[10, 0, 400], [20, 0, 420], [30, 0, 440]] },
    },
  };

  it("interpola posición, altitud y timestamp en el punto medio", () => {
    const result = issAt(feature, start + 7500);
    expect(result).not.toBe(feature);
    expect(result.geometry.coordinates).toEqual([15, 0]);
    expect(result.properties.altitudeKm).toBe(410);
    expect(result.properties.timestamp).toBe(new Date(start + 7500).toISOString());
    expect(result.properties.headingDeg).toBeCloseTo(90);
    expect(feature.geometry.coordinates).toEqual([10, 0]);
    expect(feature.properties.altitudeKm).toBe(400);
  });

  it("interpola entre los puntos vecinos posteriores", () => {
    const result = issAt(feature, start + 22500);
    expect(result.geometry.coordinates).toEqual([25, 0]);
    expect(result.properties.altitudeKm).toBe(430);
  });

  it("interpola latitud y rumbo hacia el punto siguiente", () => {
    const northbound: IssFeature = {
      ...feature,
      properties: { ...feature.properties, ephemeris: {
        start, stepSeconds: 15, points: [[10, 10, 400], [10, 20, 420]],
      } },
    };
    const result = issAt(northbound, start + 7500);
    expect(result.geometry.coordinates).toEqual([10, 15]);
    expect(result.properties.headingDeg).toBeCloseTo(0);
  });

  it.each([-1, 30001])("devuelve la misma feature fuera del rango: %s", (offset) => {
    expect(issAt(feature, start + offset)).toBe(feature);
  });

  it("devuelve la misma feature sin efemérides", () => {
    const withoutEphemeris = { ...feature, properties: { ...feature.properties, ephemeris: undefined } };
    expect(issAt(withoutEphemeris, start)).toBe(withoutEphemeris);
  });

  it.each([[179, -179, 90], [-179, 179, 270]])("cruza el antimeridiano entre %s y %s", (from, to, heading) => {
    const crossing: IssFeature = {
      ...feature,
      properties: { ...feature.properties, ephemeris: {
        start, stepSeconds: 15, points: [[from, 0, 400], [to, 0, 420]],
      } },
    };
    const result = issAt(crossing, start + 7500);
    expect(Math.abs(result.geometry.coordinates[0])).toBe(180);
    expect(result.properties.headingDeg).toBeCloseTo(heading);
  });

  it("incluye los extremos del rango", () => {
    expect(issAt(feature, start).geometry.coordinates).toEqual([10, 0]);
    const last = issAt(feature, start + 30000);
    expect(last.geometry.coordinates).toEqual([30, 0]);
    expect(last.properties.altitudeKm).toBe(440);
    expect(last.properties.headingDeg).toBeCloseTo(90);
  });
});
