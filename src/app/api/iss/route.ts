import { NextResponse } from "next/server";
import { fetchLiveIssPosition } from "@/lib/iss";

// Caché de CDN solo para respuestas OK (los errores no se cachean): sin
// esto cada visita pega directo a la API externa y consume su cuota.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" };
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchLiveIssPosition();
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (error: unknown) {
    console.error("[api/iss]", error);
    return NextResponse.json({ success: false, error: "Upstream fetch failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
