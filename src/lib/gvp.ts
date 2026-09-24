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

// Respaldo: base de volcanes de NOAA NCEI (1.608 volcanes, con el número GVP
// para enlazar la ficha del Smithsonian). El WFS del Smithsonian corta
// conexiones con frecuencia (ECONNRESET) y dejaba la capa vacía.
const NCEI_URL = "https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs";
const NCEI_PAGE = 200; // máximo que acepta la API
const GVP_TIMEOUT_MS = 8000;

interface NceiVolcano {
  newNum?: number | null;
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  morphology?: string | null;
  timeErupt?: string | null;
}

export function fromNcei(v: NceiVolcano): VolcanoFeature | null {
  if (!Number.isFinite(v.latitude) || !Number.isFinite(v.longitude)) return null;
  const num = v.newNum ?? v.id;
  return {
    type: "Feature",
    id: num,
    properties: {
      volcanoNumber: num,
      name: v.name,
      country: v.country,
      volcanoType: v.morphology ?? "—",
      lastEruptionYear: null,
      lastEruptionPeriod: v.timeErupt && v.timeErupt !== "Unknown" ? v.timeErupt : "U",
      elevationM: v.elevation ?? null,
    },
    geometry: { type: "Point", coordinates: [v.longitude, v.latitude] },
  };
}

async function fetchNceiVolcanoes(signal?: AbortSignal): Promise<VolcanoFeature[]> {
  const page = (n: number) =>
    fetch(`${NCEI_URL}?itemsPerPage=${NCEI_PAGE}&page=${n}`, { signal }).then((r) => (r.ok ? r.json() : null));
  const first = await page(1);
  if (!first?.items) return [];
  const pages: number = first.totalPages ?? 1;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2).catch(() => null)));
  const items: NceiVolcano[] = [first, ...rest].flatMap((p) => p?.items ?? []);
  const seen = new Set<number>();
  return items
    .map(fromNcei)
    .filter((f): f is VolcanoFeature => !!f && !seen.has(f.id) && (seen.add(f.id), true));
}

export async function fetchVolcanoes(signal?: AbortSignal): Promise<VolcanoGeoJSON> {
  try {
    const timeout = AbortSignal.timeout(GVP_TIMEOUT_MS);
    const res = await fetch(GVP_WFS_URL, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!res.ok) throw new Error(`Smithsonian GVP HTTP ${res.status}`);
    const data: GvpResponse = await res.json();
    const features = data.features.map(toVolcanoFeature).filter((f): f is VolcanoFeature => f !== null);
    if (features.length) return { type: "FeatureCollection", features };
    throw new Error("Smithsonian GVP sin volcanes");
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("Smithsonian GVP no disponible, usando NOAA NCEI:", error instanceof Error ? error.message : error);
  }
  try {
    return { type: "FeatureCollection", features: await fetchNceiVolcanoes(signal) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo volcanes de NOAA NCEI:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
