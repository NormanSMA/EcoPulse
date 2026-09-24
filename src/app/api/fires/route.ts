import { fetchLiveFires } from "@/lib/firms";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Focos de calor activos de NASA FIRMS.
export async function GET() {
  try {
    const data = await fetchLiveFires();
    return cachedJson(data, 900, data.features.length > 0);
  } catch (error) {
    return upstreamError("fires", error);
  }
}
