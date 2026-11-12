import { fetchActiveCyclones } from "@/lib/gdacsCyclones";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Trayectorias, pronóstico y cono de los ciclones activos (GDACS).
export async function GET() {
  try {
    const data = await fetchActiveCyclones();
    return cachedJson(data, 1800, data.features.length > 0);
  } catch (error) {
    return upstreamError("cyclones", error);
  }
}
