import { EarthquakeGeoJSON } from "./types";

const USGS_FEEDS = {
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
} as const;

export async function fetchLiveEarthquakes(
  signal?: AbortSignal,
  period: keyof typeof USGS_FEEDS = "day"
): Promise<EarthquakeGeoJSON> {
  try {
    const res = await fetch(USGS_FEEDS[period], { next: { revalidate: 300 }, signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch USGS data: ${res.statusText}`);
    }
    const data: EarthquakeGeoJSON = await res.json();
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Error fetching earthquakes:", error);
    return {
      type: "FeatureCollection",
      metadata: { generated: Date.now(), url: "", title: "Fallback", status: 500, api: "v1", count: 0 },
      features: []
    };
  }
}
