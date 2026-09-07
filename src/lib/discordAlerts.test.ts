import { describe, it, expect, vi, afterEach } from "vitest";
import {
  shouldAlertEarthquake,
  shouldAlertAirQuality,
  buildEarthquakeEmbed,
  buildAirQualityEmbed,
  sendDiscordAlert,
  processEarthquakeAlerts,
  processAirQualityAlerts,
} from "./discordAlerts";
import { EarthquakeFeature, AirQualityFeature } from "./types";

const strongQuake: EarthquakeFeature = {
  type: "Feature",
  id: "us7000strong",
  properties: {
    mag: 6.5,
    place: "50km W of Managua",
    time: 1700000000000,
    updated: 1700000000000,
    url: "https://example.com",
    alert: "orange",
    status: "reviewed",
    tsunami: 0,
    sig: 900,
  },
  geometry: { type: "Point", coordinates: [-86.5, 12.3, 15] },
};

const weakQuake: EarthquakeFeature = {
  ...strongQuake,
  id: "us7000weak",
  properties: { ...strongQuake.properties, mag: 3.2 },
};

const hazardousStation: AirQualityFeature = {
  type: "Feature",
  id: 555,
  properties: {
    station: "Ciudad Contaminada",
    pm25: 120,
    category: "hazardous",
    updated: "2026-01-01T00:00:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-90.5, 14.6] },
};

const goodStation: AirQualityFeature = {
  ...hazardousStation,
  id: 556,
  properties: { ...hazardousStation.properties, category: "good", pm25: 5 },
};

describe("shouldAlertEarthquake", () => {
  it("alerta si magnitude > 6.0", () => {
    expect(shouldAlertEarthquake(strongQuake)).toBe(true);
  });

  it("no alerta si magnitude <= 6.0", () => {
    expect(shouldAlertEarthquake(weakQuake)).toBe(false);
    expect(shouldAlertEarthquake({ ...strongQuake, properties: { ...strongQuake.properties, mag: 6.0 } })).toBe(false);
  });

  it("no alerta si mag es null", () => {
    expect(shouldAlertEarthquake({ ...strongQuake, properties: { ...strongQuake.properties, mag: null } })).toBe(false);
  });
});

describe("shouldAlertAirQuality", () => {
  it("alerta solo si category es hazardous", () => {
    expect(shouldAlertAirQuality(hazardousStation)).toBe(true);
    expect(shouldAlertAirQuality(goodStation)).toBe(false);
  });
});

describe("buildEarthquakeEmbed", () => {
  it("construye un embed con el color rojo oscuro y la magnitud en la descripcion", () => {
    const embed = buildEarthquakeEmbed(strongQuake, "https://ecopulse.example.com");
    expect(embed.color).toBe(0x8b0000);
    expect(embed.description).toContain("6.5");
    expect(embed.description).toContain("50km W of Managua");
    expect(embed.url).toBe(strongQuake.properties.url);
    expect(embed.timestamp).toBe(new Date(strongQuake.properties.time).toISOString());
    expect(embed.footer.text).toContain("EcoPulse Monitor");
  });

  it("usa la appUrl de respaldo si la feature no trae url", () => {
    const noUrlQuake = { ...strongQuake, properties: { ...strongQuake.properties, url: "" } };
    const embed = buildEarthquakeEmbed(noUrlQuake, "https://ecopulse.example.com");
    expect(embed.url).toBe("https://ecopulse.example.com");
  });
});

describe("buildAirQualityEmbed", () => {
  it("construye un embed con el PM2.5 y la estacion en la descripcion", () => {
    const embed = buildAirQualityEmbed(hazardousStation);
    expect(embed.description).toContain("120");
    expect(embed.description).toContain("Ciudad Contaminada");
  });
});

describe("sendDiscordAlert", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lanza error si Discord responde con un status no-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(
      sendDiscordAlert("https://discord.test/webhook", buildEarthquakeEmbed(strongQuake, "https://x.com"))
    ).rejects.toThrow("429");
  });

  it("no lanza si Discord responde ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    await expect(
      sendDiscordAlert("https://discord.test/webhook", buildEarthquakeEmbed(strongQuake, "https://x.com"))
    ).resolves.toBeUndefined();
  });
});

function makeFakeSupabase(alreadyNotifiedIds: string[] = []) {
  const inserted: { source_type: string; source_id: string }[] = [];
  const supabaseAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: (_col: string, sourceId: string) => ({
            gte: () => ({
              limit: () =>
                Promise.resolve({
                  data: alreadyNotifiedIds.includes(sourceId) ? [{ id: "1" }] : [],
                  error: null,
                }),
            }),
          }),
        }),
      }),
      insert: (row: { source_type: string; source_id: string }) => {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { supabaseAdmin: supabaseAdmin as never, inserted };
}

describe("processEarthquakeAlerts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("solo envia alerta para el sismo fuerte y no reenvia el ya notificado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { supabaseAdmin, inserted } = makeFakeSupabase();

    const anotherStrongQuake: EarthquakeFeature = { ...strongQuake, id: "us7000already" };

    const sent = await processEarthquakeAlerts(
      { supabaseAdmin, webhookUrl: "https://discord.test/webhook", appUrl: "https://x.com" },
      [strongQuake, weakQuake, anotherStrongQuake]
    );

    expect(sent).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(inserted.map((r) => r.source_id)).toEqual(["us7000strong", "us7000already"]);
  });

  it("no reenvia si ya fue notificado en la ultima hora", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { supabaseAdmin } = makeFakeSupabase(["us7000strong"]);

    const sent = await processEarthquakeAlerts(
      { supabaseAdmin, webhookUrl: "https://discord.test/webhook", appUrl: "https://x.com" },
      [strongQuake]
    );

    expect(sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("processAirQualityAlerts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("solo envia alerta para estaciones hazardous", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { supabaseAdmin } = makeFakeSupabase();

    const sent = await processAirQualityAlerts(
      { supabaseAdmin, webhookUrl: "https://discord.test/webhook", appUrl: "https://x.com" },
      [hazardousStation, goodStation]
    );

    expect(sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
