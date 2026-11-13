import { loadEventSources } from "@/lib/live/sources";
import { buildWidgetSummary } from "@/lib/widget";
import { badRequest, cachedJson, hasOnlyParams, parseLatLon, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Resumen para widgets de pantalla de inicio. ?lat&lon opcionales: sismo cercano.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!hasOnlyParams(url, ["lat", "lon"])) return badRequest("Parámetros no permitidos");
  const hasCoords = url.searchParams.has("lat") || url.searchParams.has("lon");
  const near = hasCoords ? parseLatLon(url, { canonical: true }) : null;
  if (hasCoords && !near) return badRequest("lat y lon deben venir juntos, con hasta 3 decimales");
  try {
    const sources = await loadEventSources(request.signal);
    const appUrl = process.env.APP_URL || url.origin;
    const summary = buildWidgetSummary(sources, appUrl, Date.now(), near ?? undefined);
    return cachedJson(summary, 300, sources.quakes.length > 0);
  } catch (error) {
    return upstreamError("widget", error);
  }
}
