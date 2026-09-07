import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseOemFile,
  interpolateStateVector,
  gmstRadians,
  eciToGeodetic,
  fetchLiveIssPosition,
  StateVector,
} from "./iss";

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

  it("interpola linealmente en el punto medio entre dos muestras", () => {
    const at = new Date("2026-09-04T12:02:00.000Z"); // punto medio exacto
    const result = interpolateStateVector(vectors, at) as StateVector;
    expect(result.x).toBeCloseTo((-304.795682412414 + -1423.488290590500) / 2, 5);
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
