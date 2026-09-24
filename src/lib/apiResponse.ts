import { NextResponse } from "next/server";

// Respuestas de las rutas /api/*: caché de CDN solo para respuestas OK y con
// datos (sin esto cada visita pega directo a la API externa y consume su
// cuota). Las librerías devuelven colecciones vacías cuando la fuente falla:
// eso nunca se cachea, así un fallo pasajero no queda congelado.

const NO_STORE = { "Cache-Control": "no-store" };

export function cachedJson(data: unknown, maxAgeSeconds: number, hasData: boolean) {
  const headers = hasData
    ? { "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 6}` }
    : NO_STORE;
  return NextResponse.json(data, { headers });
}

export function upstreamError(route: string, error: unknown, message = "Upstream fetch failed") {
  console.error(`[api/${route}]`, error);
  return NextResponse.json({ success: false, error: message }, { status: 500, headers: NO_STORE });
}

export function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400, headers: NO_STORE });
}

/** Lee lat/lon de la query y valida el rango. */
export function parseLatLon(url: URL): { lat: number; lon: number } | null {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
