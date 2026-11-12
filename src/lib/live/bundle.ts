import { withTimeout } from "../http";

// Lote de fuentes en vivo: cada fuente se pide por separado y falla sola.
// El sobre indica estado y antigüedad por fuente, para que el cliente
// conserve el último dato válido y muestre qué capa está caída.

export type SourceStatus = "ok" | "empty" | "error" | "timeout";
export type BundleId = "pulse" | "hazards" | "orbit";

export interface SourceResult<T> {
  status: SourceStatus;
  /** Instante de la respuesta de la fuente (ms epoch del servidor). */
  fetchedAt: number;
  tookMs: number;
  ttlSeconds: number;
  /** null si la fuente falló o agotó el tiempo. */
  data: T | null;
  error?: string;
}

export interface LiveBundle<S extends Record<string, unknown>> {
  bundle: BundleId;
  generatedAt: number;
  ttlSeconds: number;
  /** true si alguna fuente falló. */
  partial: boolean;
  sources: { [K in keyof S]: SourceResult<S[K]> };
}

export interface SourceDef<T> {
  load: (signal: AbortSignal) => Promise<T>;
  ttlSeconds: number;
  timeoutMs?: number;
  isEmpty: (data: T) => boolean;
}

export type SourceDefs<S extends Record<string, unknown>> = { [K in keyof S]: SourceDef<S[K]> };

export interface BundleOptions {
  ttlSeconds: number;
  /** Ventana de stale-while-revalidate. Por defecto 6 veces el TTL. */
  swrSeconds?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 8000;
const PARTIAL_TTL_SECONDS = 60;

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export async function loadSource<T>(def: SourceDef<T>, signal?: AbortSignal): Promise<SourceResult<T>> {
  const startedAt = Date.now();
  const base = { ttlSeconds: def.ttlSeconds };
  try {
    const data = await def.load(withTimeout(def.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal));
    const fetchedAt = Date.now();
    return { ...base, status: def.isEmpty(data) ? "empty" : "ok", fetchedAt, tookMs: fetchedAt - startedAt, data };
  } catch (error) {
    // El cliente cerró la conexión: no hay respuesta que construir.
    if (signal?.aborted) throw error;
    const fetchedAt = Date.now();
    return {
      ...base,
      status: isTimeout(error) ? "timeout" : "error",
      fetchedAt,
      tookMs: fetchedAt - startedAt,
      data: null,
      // Mensaje corto para diagnóstico; sin trazas ni URLs con claves.
      error: isTimeout(error) ? "timeout" : "upstream",
    };
  }
}

export async function loadBundle<S extends Record<string, unknown>>(
  bundle: BundleId,
  defs: SourceDefs<S>,
  options: BundleOptions,
): Promise<LiveBundle<S>> {
  const keys = Object.keys(defs) as (keyof S & string)[];
  const results = await Promise.all(keys.map((key) => loadSource(defs[key], options.signal)));
  const sources = Object.fromEntries(keys.map((key, index) => [key, results[index]])) as LiveBundle<S>["sources"];
  return {
    bundle,
    generatedAt: Date.now(),
    ttlSeconds: options.ttlSeconds,
    partial: results.some((result) => result.data === null),
    sources,
  };
}

/**
 * Caché de CDN según el resultado: completo usa el TTL del lote, parcial se
 * reintenta pronto y un lote sin ningún dato nunca se guarda.
 */
export function bundleCacheControl(
  bundle: { partial: boolean; ttlSeconds: number; sources: Record<string, SourceResult<unknown>> },
  swrSeconds?: number,
): string {
  const results = Object.values(bundle.sources);
  if (results.every((result) => result.data === null)) return "no-store";
  if (bundle.partial) return `public, s-maxage=${PARTIAL_TTL_SECONDS}, stale-while-revalidate=${PARTIAL_TTL_SECONDS}`;
  return `public, s-maxage=${bundle.ttlSeconds}, stale-while-revalidate=${swrSeconds ?? bundle.ttlSeconds * 6}`;
}
