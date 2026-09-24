import { geocode } from "@/lib/pointInfo";
import { badRequest, cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Buscador de lugares (Photon / OpenStreetMap), proxy para no abrir la CSP.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return badRequest("consulta inválida");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  try {
    const results = await geocode(q, lang);
    return cachedJson({ results }, 86400, results.length > 0);
  } catch (error) {
    return upstreamError("geocode", error);
  }
}
