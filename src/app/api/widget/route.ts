import { fetchMergedEarthquakes } from "@/lib/earthquakes";
import { fetchActiveCyclones } from "@/lib/gdacsCyclones";
import { fetchActiveVolcanoes } from "@/lib/gvpWeekly";
import { fetchLiveDisasters } from "@/lib/gdacs";
import { buildWidgetSummary } from "@/lib/widget";
import { cachedJson, parseLatLon, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Resumen para widgets de pantalla de inicio. ?lat&lon opcionales: sismo cercano.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const near = url.searchParams.has("lat") ? parseLatLon(url) ?? undefined : undefined;
  try {
    const [quakes, cyclones, volcanoes, disasters] = await Promise.all([
      fetchMergedEarthquakes("day"),
      fetchActiveCyclones(),
      fetchActiveVolcanoes(),
      fetchLiveDisasters(),
    ]);
    const appUrl = process.env.APP_URL || url.origin;
    const summary = buildWidgetSummary(
      { quakes: quakes.features, cyclones: cyclones.features, volcanoes: volcanoes.features, disasters: disasters.features },
      appUrl,
      Date.now(),
      near
    );
    return cachedJson(summary, 300, quakes.features.length > 0);
  } catch (error) {
    return upstreamError("widget", error);
  }
}
