import { fetchGlobalAirQuality } from "@/lib/openaq";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// PM2.5 de ~10.000 estaciones OpenAQ con lectura de las últimas 3 h.
export async function GET() {
  try {
    const data = await fetchGlobalAirQuality();
    return cachedJson(data, 900, data.features.length > 0);
  } catch (error) {
    return upstreamError("air-quality", error);
  }
}
