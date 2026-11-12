/** Señal que aborta por tiempo o por la señal externa, lo que ocurra primero. */
export function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; next?: { revalidate: number } } = {},
): Promise<T> {
  const { timeoutMs = 8000, signal, ...rest } = init;
  const res = await fetch(url, { ...rest, signal: withTimeout(timeoutMs, signal ?? undefined) });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return (await res.json()) as T;
}
