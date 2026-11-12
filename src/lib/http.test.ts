import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, withTimeout } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("fetchJson", () => {
  it("devuelve el JSON y pasa una señal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson<{ a: number }>("https://example.com/x")).resolves.toEqual({ a: 1 });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("lanza host y estado si !ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchJson("https://example.com/x")).rejects.toThrow("example.com HTTP 503");
  });
});

describe("withTimeout", () => {
  it("aborta con la señal externa", () => {
    const ctrl = new AbortController();
    const s = withTimeout(10_000, ctrl.signal);
    ctrl.abort();
    expect(s.aborted).toBe(true);
  });
});
