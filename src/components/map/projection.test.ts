import { describe, expect, it, vi } from "vitest";
import { introStartZoom, shouldPlayIntro } from "./projection";

function fakeStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set("ecopulse-intro-seen", initialValue);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
}

describe("introStartZoom", () => {
  it.each([
    [0, 0.6],
    [2.5, 0.6],
    [2.8, 0.6],
    [3, 0.8],
    [3.4, 1.2],
    [8, 1.2],
  ])("calcula el zoom inicial para %s", (finalZoom, expected) => {
    expect(introStartZoom(finalZoom)).toBeCloseTo(expected);
  });
});

describe("shouldPlayIntro", () => {
  it("marca la sesión antes de reproducir y evita repeticiones", () => {
    const storage = fakeStorage();
    expect(shouldPlayIntro(storage, false)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("ecopulse-intro-seen", "true");
    expect(shouldPlayIntro(storage, false)).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("omite una sesión marcada", () => {
    const storage = fakeStorage("true");
    expect(shouldPlayIntro(storage, false)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("permite una sesión con valor distinto de true", () => {
    expect(shouldPlayIntro(fakeStorage("false"), false)).toBe(true);
  });

  it("respeta movimiento reducido sin acceder al almacenamiento", () => {
    const storage = fakeStorage();
    expect(shouldPlayIntro(storage, true)).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("omite almacenamiento ausente", () => {
    expect(shouldPlayIntro(null, false)).toBe(false);
  });

  it("omite errores de lectura", () => {
    const storage = fakeStorage();
    storage.getItem.mockImplementation(() => { throw new Error("Lectura bloqueada"); });
    expect(shouldPlayIntro(storage, false)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("omite errores de escritura", () => {
    const storage = fakeStorage();
    storage.setItem.mockImplementation(() => { throw new Error("Escritura bloqueada"); });
    expect(shouldPlayIntro(storage, false)).toBe(false);
  });
});
