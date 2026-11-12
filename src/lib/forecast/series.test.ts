import { describe, expect, it } from "vitest";
import { accumulate, frameAt, hourIndexAt, sampleAt, sliceHours, usAqiCategory, windUV } from "./series";
import type { GridForecast, HourlyAirQuality, HourlyWeather } from "./types";

const H = 3_600_000;
const T0 = 1_700_000_000_000;

function weather(n: number): HourlyWeather {
  const f = (k: number) => Array.from({ length: n }, (_, i) => i * k);
  return {
    time: Array.from({ length: n }, (_, i) => T0 + i * H),
    temperature: f(1), apparentTemperature: f(1), humidity: f(1), surfacePressure: f(1), cloudCover: f(1),
    precipitationProbability: f(1), precipitation: Array(n).fill(0.5), windSpeed: Array(n).fill(10), windDirection: Array(n).fill(0),
    windGusts: Array(n).fill(15), uvIndex: Array(n).fill(null), weatherCode: Array(n).fill(3), isDay: Array(n).fill(true),
  };
}

describe("sliceHours", () => {
  it("recorta todas las columnas a [from, from + h)", () => {
    const s = sliceHours(weather(72), 24);
    expect(s.time).toHaveLength(24);
    expect(s.temperature).toHaveLength(24);
    expect(s.time[23]).toBe(T0 + 23 * H);
    expect(sliceHours(weather(72), 48, T0 + 30 * H).time).toHaveLength(42);
    expect(sliceHours(weather(10), 72).time).toHaveLength(10);
  });
});

describe("hourIndexAt", () => {
  const time = [T0, T0 + H, T0 + 2 * H];
  it("devuelve el mayor indice con time <= at", () => {
    expect(hourIndexAt(time, T0)).toBe(0);
    expect(hourIndexAt(time, T0 + H - 1)).toBe(0);
    expect(hourIndexAt(time, T0 + H)).toBe(1);
    expect(hourIndexAt(time, T0 + 2 * H + H)).toBe(2);
  });
  it("null fuera de rango", () => {
    expect(hourIndexAt(time, T0 - 1)).toBeNull();
    expect(hourIndexAt(time, T0 + 3 * H + 1)).toBeNull();
    expect(hourIndexAt([], T0)).toBeNull();
  });
});

describe("windUV", () => {
  it("viento del norte sopla hacia el sur", () => {
    const { u, v } = windUV(10, 0);
    expect(u).toBeCloseTo(0);
    expect(v).toBeCloseTo(-10);
  });
  it("viento del este sopla hacia el oeste", () => {
    const { u, v } = windUV(10, 90);
    expect(u).toBeCloseTo(-10);
    expect(v).toBeCloseTo(0);
  });
});

describe("accumulate", () => {
  it("suma acumulada", () => {
    expect(accumulate([1, 2, 3])).toEqual([1, 3, 6]);
    expect(accumulate([])).toEqual([]);
  });
});

describe("sampleAt", () => {
  const w = weather(72);
  const air: HourlyAirQuality = { time: [T0 + H, T0 + 2 * H], pm25: [5, 6], pm10: [7, 8], usAqi: [20, 30] };
  it("primera hora", () => {
    const s = sampleAt(w, null, T0)!;
    expect(s.hourIndex).toBe(0);
    expect(s.precipitationAccum).toBe(0.5);
    expect(s.pm25).toBeNull();
    expect(s.wind.speed).toBe(10);
    expect(s.wind.gust).toBe(15);
  });
  it("ultima hora acumula toda la serie y busca aire en su propio eje", () => {
    const s = sampleAt(w, air, T0 + 71 * H + 30 * 60_000)!;
    expect(s.hourIndex).toBe(71);
    expect(s.precipitationAccum).toBeCloseTo(36);
    expect(sampleAt(w, air, T0 + 2 * H)!.usAqi).toBe(30);
    expect(sampleAt(w, air, T0)!.usAqi).toBeNull();
  });
  it("null fuera de rango", () => {
    expect(sampleAt(w, air, T0 - 1)).toBeNull();
    expect(sampleAt(w, air, T0 + 73 * H)).toBeNull();
  });
});

describe("frameAt", () => {
  const full: Partial<ReturnType<typeof weather>> = { ...weather(3) };
  delete full.time;
  const w = full as Omit<ReturnType<typeof weather>, "time">;
  const grid: GridForecast = {
    points: [{ id: "a", lon: -86, lat: 12 }],
    time: weather(3).time,
    weather: [w],
    air: [null],
    meta: { generatedAt: 0, horizonHours: 72, utcOffsetSeconds: 0, models: { weather: "open-meteo", air: "open-meteo-cams" }, source: "network" },
  };
  it("arma el cuadro de la hora pedida", () => {
    const f = frameAt(grid, T0 + H)!;
    expect(f.time).toBe(T0 + H);
    expect(f.features).toHaveLength(1);
    expect(f.features[0]).toMatchObject({ lon: -86, lat: 12, windSpeed: 10, temperature: 1 });
    expect(f.features[0].v).toBeCloseTo(-10);
  });
  it("null fuera de rango", () => {
    expect(frameAt(grid, T0 - 1)).toBeNull();
  });
});

describe("usAqiCategory", () => {
  it("respeta los cortes", () => {
    expect(usAqiCategory(null)).toBeNull();
    expect(usAqiCategory(50)).toBe("good");
    expect(usAqiCategory(51)).toBe("moderate");
    expect(usAqiCategory(100)).toBe("moderate");
    expect(usAqiCategory(101)).toBe("sensitive");
    expect(usAqiCategory(150)).toBe("sensitive");
    expect(usAqiCategory(151)).toBe("unhealthy");
    expect(usAqiCategory(200)).toBe("unhealthy");
    expect(usAqiCategory(201)).toBe("veryUnhealthy");
    expect(usAqiCategory(300)).toBe("veryUnhealthy");
    expect(usAqiCategory(301)).toBe("hazardous");
  });
});
