import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/geo";
import type { WindField } from "@/lib/forecast/field";
import { createParticles, particleCountFor, stepParticles, type Particle } from "./windParticles";

const bbox: BBox = [0, 0, 10, 10];
const wind = (u: number, v: number): WindField => ({
  u: new Float32Array(4).fill(u),
  v: new Float32Array(4).fill(v),
  width: 2,
  height: 2,
  bbox,
});
const rng = () => 0.5;
const particle = (over: Partial<Particle> = {}): Particle => ({
  lon: 5,
  lat: 5,
  age: 0,
  maxAge: 100,
  ...over,
});

describe("stepParticles", () => {
  it("avanza con el viento", () => {
    const p = particle();
    stepParticles([p], wind(36, 0), 10, bbox, rng);
    expect(p.lon).toBeGreaterThan(5);
    expect(p.lat).toBeCloseTo(5);
    expect(p.age).toBe(10);
  });

  it("recicla por edad", () => {
    const p = particle({ lon: 2, lat: 3, age: 99 });
    stepParticles([p], wind(1, 1), 5, bbox, rng);
    expect(p.age).toBe(0);
    expect([p.lon, p.lat]).toEqual([5, 5]);
  });

  it("recicla al salir de la caja", () => {
    const p = particle({ lon: 9.9999 });
    stepParticles([p], wind(100000, 0), 10, bbox, rng);
    expect(p.age).toBe(0);
    expect(p.lon).toBe(5);
  });

  it("viento cero reinicia", () => {
    const p = particle({ lon: 2, lat: 3, age: 10 });
    stepParticles([p], wind(0, 0), 1, bbox, rng);
    expect(p.age).toBe(0);
    expect([p.lon, p.lat]).toEqual([5, 5]);
  });
});

describe("createParticles", () => {
  it("crea dentro de la caja", () => {
    const ps = createParticles(20, bbox, rng);
    expect(ps).toHaveLength(20);
    expect(ps.every((p) => p.lon === 5 && p.lat === 5)).toBe(true);
  });
});

describe("particleCountFor", () => {
  it("aplica topes y minimo", () => {
    expect(particleCountFor(1e9, false)).toBe(3000);
    expect(particleCountFor(1e9, true)).toBe(1200);
    expect(particleCountFor(10, false)).toBe(300);
  });
});
