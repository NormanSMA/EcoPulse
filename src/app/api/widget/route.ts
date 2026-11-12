import { loadEventSources } from "@/lib/live/sources";
import { buildWidgetSummary } from "@/lib/widget";
import { cachedJson, parseLatLon, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Resumen para widgets de pantalla de inicio. ?lat&lon opcionales: sismo cercano.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const near = url.searchParams.has("lat") ? parseLatLon(url) ?? undefined : undefined;
  try {
    const sources = await loadEventSources(request.signal);
    const appUrl = process.env.APP_URL || url.origin;
    const summary = buildWidgetSummary(sources, appUrl, Date.now(), near);
    return cachedJson(summary, 300, sources.quakes.length > 0);
  } catch (error) {
    return upstreamError("widget", error);
  }
}
