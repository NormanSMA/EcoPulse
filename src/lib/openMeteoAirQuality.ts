import { AirQualityModelFeature, AirQualityModelGeoJSON } from "./types";
import { CITY_ANCHORS } from "./cityAnchors";
import { getAQICategory } from "./openaq";

const OPEN_METEO_AQ_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

interface OpenMeteoAQResponse {
  current: {
    time: string;
    pm2_5: number;
  };
}

export async function fetchModeledAirQuality(signal?: AbortSignal): Promise<AirQualityModelGeoJSON> {
  const lats = CITY_ANCHORS.map((c) => c.lat).join(",");
  const lons = CITY_ANCHORS.map((c) => c.lon).join(",");
  const url = `${OPEN_METEO_AQ_BASE}?latitude=${lats}&longitude=${lons}&current=pm2_5&timezone=UTC`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo Air Quality HTTP ${res.status}`);
    }

    const data: OpenMeteoAQResponse[] = await res.json();
    const features: AirQualityModelFeature[] = data.map((entry, idx) => {
      const anchor = CITY_ANCHORS[idx];
      const pm25 = entry.current.pm2_5;
      return {
        type: "Feature",
        id: anchor.name,
        properties: {
          city: anchor.name,
          pm25,
          category: getAQICategory(pm25),
          updated: new Date(entry.current.time + "Z").toISOString(),
        },
        geometry: {
          type: "Point",
          coordinates: [anchor.lon, anchor.lat],
        },
      };
    });

    return { type: "FeatureCollection", features };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo calidad de aire modelada de Open-Meteo:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
