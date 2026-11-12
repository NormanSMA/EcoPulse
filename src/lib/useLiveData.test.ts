import { describe, expect, it } from "vitest";
import type { LiveBundle, SourceResult } from "./live/bundle";
import { nextSourceStatus, type LiveSourceStatus } from "./useLiveData";

const loading = { status: "loading", fetchedAt: null } as const;
const initial: LiveSourceStatus = {
  earthquakes: loading,
  fires: loading,
  disasters: loading,
  cyclones: loading,
  volcanoes: loading,
  iss: loading,
};

const result = (status: SourceResult<unknown>["status"], fetchedAt: number): SourceResult<unknown> => ({
  status,
  fetchedAt,
  tookMs: 1,
  ttlSeconds: 900,
  data: status === "ok" || status === "empty" ? { features: [] } : null,
});

type Hazards = { fires: unknown; disasters: unknown };
const bundle = (sources: LiveBundle<Hazards>["sources"]): LiveBundle<Hazards> => ({
  bundle: "hazards",
  generatedAt: 1,
  ttlSeconds: 900,
  partial: false,
  sources,
});
const KEYS = ["fires", "disasters"] as const;

describe("nextSourceStatus", () => {
  it("registra estado y hora de cada fuente con datos", () => {
    const next = nextSourceStatus(initial, KEYS, bundle({ fires: result("ok", 100), disasters: result("empty", 110) }));
    expect(next.fires).toEqual({ status: "ok", fetchedAt: 100 });
    expect(next.disasters).toEqual({ status: "empty", fetchedAt: 110 });
    expect(next.earthquakes).toBe(loading);
  });

  it("una fuente caida conserva la hora de su ultimo dato valido", () => {
    const first = nextSourceStatus(initial, KEYS, bundle({ fires: result("ok", 100), disasters: result("ok", 100) }));
    const next = nextSourceStatus(first, KEYS, bundle({ fires: result("timeout", 200), disasters: result("ok", 200) }));
    expect(next.fires).toEqual({ status: "timeout", fetchedAt: 100 });
    expect(next.disasters).toEqual({ status: "ok", fetchedAt: 200 });
  });

  it("sin lote marca en error todas sus fuentes", () => {
    const next = nextSourceStatus(initial, KEYS, null);
    expect(next.fires).toEqual({ status: "error", fetchedAt: null });
    expect(next.disasters).toEqual({ status: "error", fetchedAt: null });
    expect(next.iss).toBe(loading);
  });
});
