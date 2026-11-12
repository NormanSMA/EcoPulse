import { describe, expect, it } from "vitest";
import { bundleCacheControl, loadBundle, loadSource, type SourceDef } from "./bundle";

interface Collection {
  features: number[];
}

const source = (load: SourceDef<Collection>["load"], timeoutMs?: number): SourceDef<Collection> => ({
  load,
  ttlSeconds: 900,
  timeoutMs,
  isEmpty: (data) => data.features.length === 0,
});

const ok = source(async () => ({ features: [1, 2] }));
const empty = source(async () => ({ features: [] }));
const broken = source(async () => {
  throw new Error("HTTP 500 https://fuente.test/?key=secreta");
});
const slow = source(
  (signal) => new Promise<Collection>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason));
  }),
  20,
);

describe("loadSource", () => {
  it("marca ok cuando hay datos", async () => {
    const result = await loadSource(ok);
    expect(result).toMatchObject({ status: "ok", ttlSeconds: 900, data: { features: [1, 2] } });
    expect(result.error).toBeUndefined();
  });

  it("distingue vacio de caido", async () => {
    expect(await loadSource(empty)).toMatchObject({ status: "empty", data: { features: [] } });
    expect(await loadSource(broken)).toMatchObject({ status: "error", data: null });
  });

  it("no filtra el mensaje interno del error", async () => {
    const result = await loadSource(broken);
    expect(result.error).toBe("upstream");
    expect(JSON.stringify(result)).not.toContain("secreta");
  });

  it("marca timeout cuando la fuente no responde a tiempo", async () => {
    expect(await loadSource(slow)).toMatchObject({ status: "timeout", data: null, error: "timeout" });
  });

  it("relanza cuando el cliente aborta la peticion", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadSource(slow, controller.signal)).rejects.toBeDefined();
  });
});

describe("loadBundle", () => {
  it("responde con el resto cuando una fuente falla", async () => {
    const bundle = await loadBundle("hazards", { fires: ok, disasters: broken, cyclones: empty }, { ttlSeconds: 900 });
    expect(bundle.bundle).toBe("hazards");
    expect(bundle.partial).toBe(true);
    expect(bundle.sources.fires.status).toBe("ok");
    expect(bundle.sources.disasters.status).toBe("error");
    expect(bundle.sources.cyclones.status).toBe("empty");
  });

  it("una fuente lenta no bloquea a las demas", async () => {
    const bundle = await loadBundle("hazards", { fires: ok, disasters: slow }, { ttlSeconds: 900 });
    expect(bundle.sources.fires.data).toEqual({ features: [1, 2] });
    expect(bundle.sources.disasters.status).toBe("timeout");
  });

  it("vacio no cuenta como fallo parcial", async () => {
    const bundle = await loadBundle("hazards", { fires: ok, cyclones: empty }, { ttlSeconds: 900 });
    expect(bundle.partial).toBe(false);
  });
});

describe("bundleCacheControl", () => {
  it("lote completo usa el TTL del lote", async () => {
    const bundle = await loadBundle("hazards", { fires: ok, cyclones: empty }, { ttlSeconds: 900 });
    expect(bundleCacheControl(bundle)).toBe("public, s-maxage=900, stale-while-revalidate=5400");
    expect(bundleCacheControl(bundle, 300)).toBe("public, s-maxage=900, stale-while-revalidate=300");
  });

  it("lote parcial se reintenta pronto", async () => {
    const bundle = await loadBundle("hazards", { fires: ok, disasters: broken }, { ttlSeconds: 900 });
    expect(bundleCacheControl(bundle)).toBe("public, s-maxage=60, stale-while-revalidate=60");
  });

  it("lote sin ningun dato no se guarda", async () => {
    const bundle = await loadBundle("hazards", { fires: broken, disasters: slow }, { ttlSeconds: 900 });
    expect(bundleCacheControl(bundle)).toBe("no-store");
  });
});
