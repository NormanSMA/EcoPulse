import { fetchLiveIssPosition } from "@/lib/iss";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Posición, trayectoria real y huella de visibilidad de la ISS.
export async function GET() {
  try {
    const data = await fetchLiveIssPosition();
    return cachedJson(data, 10, data.features.length > 0);
  } catch (error) {
    return upstreamError("iss", error);
  }
}
