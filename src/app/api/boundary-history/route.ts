import { badRequest, cachedJson, upstreamError } from "@/lib/apiResponse";
import { BOUNDARY_HISTORY, fetchBoundaryHistory, findPlateBoundary, summarizeBoundaryHistory } from "@/lib/boundaryHistory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const boundary = findPlateBoundary(parameters.get("plates"));
  if (parameters.getAll("plates").length !== 1 || !boundary) {
    return badRequest("plates inválido: indica un límite existente, por ejemplo NZ-SA");
  }
  try {
    const features = await fetchBoundaryHistory(boundary, request.signal);
    return cachedJson({
      type: "FeatureCollection",
      metadata: {
        plates: boundary.plates,
        source: "USGS",
        starttime: BOUNDARY_HISTORY.starttime,
        minMagnitude: BOUNDARY_HISTORY.minMagnitude,
        radiusKm: BOUNDARY_HISTORY.radiusKm,
        count: features.length,
      },
      ...summarizeBoundaryHistory(features),
    }, 86_400, features.length > 0);
  } catch (error) {
    return upstreamError("boundary-history", error);
  }
}
