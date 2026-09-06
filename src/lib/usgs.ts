import { EarthquakeGeoJSON } from "./types";

const USGS_DAY_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export async function fetchLiveEarthquakes(signal?: AbortSignal): Promise<EarthquakeGeoJSON> {
  try {
    const res = await fetch(USGS_DAY_FEED, { next: { revalidate: 300 }, signal });
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
