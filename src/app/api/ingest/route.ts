import { NextResponse } from "next/server";
import { fetchLiveEarthquakes } from "@/lib/usgs";

export async function GET() {
  try {
    const earthquakes = await fetchLiveEarthquakes();
    return NextResponse.json({
      success: true,
      count: earthquakes.features.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
