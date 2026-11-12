import { fetchPointInfo } from "@/lib/pointInfo";
import { badRequest, cachedJson, hasOnlyParams, parseLatLon, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Tiempo actual, pronóstico horario de 72 h, aire modelado y nombre del lugar para un punto.
// Si el aire (CAMS) falla, responde 200 con `air: null` y el pronóstico completo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!hasOnlyParams(url, ["lat", "lon", "lang"])) return badRequest("parámetros no admitidos");
  const point = parseLatLon(url, { canonical: true });
  if (!point) return badRequest("lat/lon inválidos: usa decimales de hasta 3 cifras");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  try {
    const info = await fetchPointInfo(point.lat, point.lon, lang);
    return cachedJson(info, 900, info.current !== null);
  } catch (error) {
    return upstreamError("point", error);
  }
}
