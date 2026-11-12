export type ForecastHorizon = 24 | 48 | 72;

export interface HourlyWeather {
  time: number[];
  temperature: number[];
  apparentTemperature: number[];
  humidity: number[];
  surfacePressure: number[];
  cloudCover: number[];
  precipitationProbability: (number | null)[];
  precipitation: number[];
  windSpeed: number[];
  windDirection: number[];
  windGusts: number[];
  uvIndex: (number | null)[];
  weatherCode: number[];
  isDay: boolean[];
}

export interface HourlyAirQuality {
  time: number[];
  pm25: (number | null)[];
  pm10: (number | null)[];
  usAqi: (number | null)[];
}

export interface CurrentWeather {
  temperature: number;
  apparent: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  precipitation: number;
  cloudCover: number;
  surfacePressure: number;
  uvIndex: number | null;
  weatherCode: number;
  isDay: boolean;
}

export interface ForecastMeta {
  generatedAt: number;
  horizonHours: 72;
  utcOffsetSeconds: number;
  models: { weather: "open-meteo"; air: "open-meteo-cams" };
  source: "network" | "pack";
}

export interface ForecastCore {
  current: CurrentWeather | null;
  weather: HourlyWeather | null;
  air: HourlyAirQuality | null;
  meta: ForecastMeta;
}

export interface PointForecast extends ForecastCore {
  lat: number;
  lon: number;
  place: { name: string | null; region: string | null; country: string | null };
}

export interface GridPoint {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  anchor?: boolean;
}

export interface GridForecast {
  points: GridPoint[];
  time: number[];
  weather: Omit<HourlyWeather, "time">[];
  air: (Omit<HourlyAirQuality, "time"> | null)[];
  meta: ForecastMeta;
}

export interface WindVector {
  u: number;
  v: number;
  speed: number;
  gust: number;
}

export interface ForecastSample {
  time: number;
  hourIndex: number;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  surfacePressure: number;
  cloudCover: number;
  precipitation: number;
  precipitationAccum: number;
  precipitationProbability: number | null;
  wind: WindVector;
  windDirection: number;
  uvIndex: number | null;
  weatherCode: number;
  isDay: boolean;
  pm25: number | null;
  pm10: number | null;
  usAqi: number | null;
}

export interface WeatherFrame {
  time: number;
  features: {
    lon: number;
    lat: number;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    u: number;
    v: number;
    cloudCover: number;
    precipitation: number;
    precipitationProbability: number | null;
    temperature: number;
  }[];
}
