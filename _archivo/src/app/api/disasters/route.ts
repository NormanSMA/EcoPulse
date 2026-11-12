import { fetchLiveDisasters } from "@/lib/gdacs";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Desastres vigentes de GDACS (inundaciones, ciclones, sequías, erupciones).
export async function GET() {
  try {
    const data = await fetchLiveDisasters();
    return cachedJson(data, 900, data.features.length > 0);
  } catch (error) {
    return upstreamError("disasters", error);
  }
}
