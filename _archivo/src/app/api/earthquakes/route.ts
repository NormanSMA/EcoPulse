import { fetchMergedEarthquakes, type QuakePeriod } from "@/lib/earthquakes";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Sismos USGS + EMSC deduplicados. period=day (24 h, por defecto) o week.
export async function GET(request: Request) {
  const period: QuakePeriod = new URL(request.url).searchParams.get("period") === "week" ? "week" : "day";
  try {
    const data = await fetchMergedEarthquakes(period);
    return cachedJson(data, period === "week" ? 900 : 120, data.features.length > 0);
  } catch (error) {
    return upstreamError("earthquakes", error);
  }
}
