import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./db";
import { loadSnapshot, saveSnapshot } from "./liveSnapshot";

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("ecopulse");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe("liveSnapshot", () => {
  it("ida y vuelta", async () => {
    expect(await saveSnapshot("pulse", { a: [1, 2] }, 123)).toBe(true);
    expect(await loadSnapshot<{ a: number[] }>("pulse")).toEqual({ data: { a: [1, 2] }, savedAt: 123 });
  });

  it("devuelve null sin dato y guarda por separado", async () => {
    expect(await loadSnapshot("hazards")).toBeNull();
    await saveSnapshot("pulse-week", "x", 1);
    expect(await loadSnapshot("pulse")).toBeNull();
    expect((await loadSnapshot<string>("pulse-week"))?.data).toBe("x");
  });
});
