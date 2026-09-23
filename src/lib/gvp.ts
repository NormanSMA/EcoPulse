import { VolcanoFeature, VolcanoGeoJSON } from "./types";

const GVP_WFS_URL =
  "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&propertyName=Volcano_Number,Volcano_Name,Country,Primary_Volcano_Type,Last_Eruption_Year,Elevation,GeoLocation";

interface GvpRawFeature {
  geometry: { type: string; coordinates: [number, number] } | null;
  properties: {
    Volcano_Number: number;
    Volcano_Name: string;
    Country: string;
    Primary_Volcano_Type: string;
    Last_Eruption_Year: number | null;
    Elevation: number | null;
  };
}

interface GvpResponse {
  features: GvpRawFeature[];
}

export function toVolcanoFeature(raw: GvpRawFeature): VolcanoFeature | null {
  if (!raw.geometry || raw.geometry.type !== "Point") return null;
  const { properties } = raw;

  return {
    type: "Feature",
    id: properties.Volcano_Number,
    properties: {
      volcanoNumber: properties.Volcano_Number,
      name: properties.Volcano_Name,
      country: properties.Country,
      volcanoType: properties.Primary_Volcano_Type,
      // La API real a veces omite el campo en vez de mandar null explicito.
      lastEruptionYear: properties.Last_Eruption_Year ?? null,
      elevationM: properties.Elevation ?? null,
    },
    geometry: {
      type: "Point",
      coordinates: raw.geometry.coordinates,
    },
  };
}

export async function fetchVolcanoes(signal?: AbortSignal): Promise<VolcanoGeoJSON> {
  try {
    // El WFS del Smithsonian corta conexiones de vez en cuando (ECONNRESET):
    // un reintento breve evita dejar la capa vacía por un fallo transitorio.
    const res = await fetch(GVP_WFS_URL, { signal }).catch(async (err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      await new Promise((r) => setTimeout(r, 1000));
      return fetch(GVP_WFS_URL, { signal });
    });
    if (!res.ok) {
      throw new Error(`Smithsonian GVP HTTP ${res.status}`);
    }
    const data: GvpResponse = await res.json();
    const features = data.features
      .map(toVolcanoFeature)
      .filter((f): f is VolcanoFeature => f !== null);

    return { type: "FeatureCollection", features };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo volcanes de Smithsonian GVP:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
