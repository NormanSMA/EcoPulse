import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveBundle, SourceResult } from "@/lib/live/bundle";

const loadLiveBundle = vi.fn();
vi.mock("@/lib/live/sources", () => ({
  BUNDLE_SWR_SECONDS: { orbit: 300 },
  isBundleId: (value: string) => ["pulse", "hazards", "orbit"].includes(value),
  loadLiveBundle: (...args: unknown[]) => loadLiveBundle(...args),
}));

import { GET } from "./route";

afterEach(() => {
  loadLiveBundle.mockReset();
  vi.restoreAllMocks();
});

const call = (bundle: string, query = "") =>
  GET(new Request(`http://localhost/api/live/${bundle}${query}`), { params: Promise.resolve({ bundle }) });

const result = (data: unknown): SourceResult<unknown> => ({
  status: data === null ? "error" : "ok",
  fetchedAt: 1,
  tookMs: 1,
  ttlSeconds: 900,
  data,
});

const bundle = (sources: Record<string, SourceResult<unknown>>, ttlSeconds = 900): LiveBundle<Record<string, unknown>> => ({
  bundle: "hazards",
  generatedAt: 1,
  ttlSeconds,
  partial: Object.values(sources).some((source) => source.data === null),
  sources,
});

describe("GET /api/live/[bundle]", () => {
  it("responde 404 sin consultar fuentes si el lote no existe", async () => {
    const response = await call("clima");
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(loadLiveBundle).not.toHaveBeenCalled();
  });

  it("responde 400 si el periodo no es valido", async () => {
    const response = await call("pulse", "?period=month");
    expect(response.status).toBe(400);
    expect(loadLiveBundle).not.toHaveBeenCalled();
  });

  it("pasa el periodo y cachea el lote completo con su TTL", async () => {
    loadLiveBundle.mockResolvedValue(bundle({ earthquakes: result({ features: [1] }) }, 120));
    const response = await call("pulse", "?period=week");
    expect(response.status).toBe(200);
    expect(loadLiveBundle.mock.calls[0].slice(0, 2)).toEqual(["pulse", "week"]);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=120, stale-while-revalidate=720");
  });

  it("acorta la cache cuando el lote llega parcial", async () => {
    loadLiveBundle.mockResolvedValue(bundle({ fires: result({ features: [1] }), disasters: result(null) }));
    const response = await call("hazards");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=60");
    expect((await response.json()).partial).toBe(true);
  });

  it("no cachea un lote sin datos", async () => {
    loadLiveBundle.mockResolvedValue(bundle({ fires: result(null), disasters: result(null) }));
    expect((await call("hazards")).headers.get("Cache-Control")).toBe("no-store");
  });

  it("limita la ventana stale de la orbita", async () => {
    loadLiveBundle.mockResolvedValue(bundle({ iss: result({ features: [1] }) }, 300));
    expect((await call("orbit")).headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=300");
  });

  it("responde 500 sin cache si la carga lanza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loadLiveBundle.mockRejectedValue(new Error("fallo"));
    const response = await call("hazards");
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
