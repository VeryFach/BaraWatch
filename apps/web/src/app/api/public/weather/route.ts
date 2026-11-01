import { NextResponse } from "next/server";

export const revalidate = 900;

const LOCATION = {
  name: "Kalimantan Tengah",
  latitude: -2.2096,
  longitude: 113.9213,
};

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
  current_units?: {
    temperature_2m?: string;
    relative_humidity_2m?: string;
    wind_speed_10m?: string;
  };
};

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: String(LOCATION.latitude),
      longitude: String(LOCATION.longitude),
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      timezone: "UTC",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("Open-Meteo request failed");

    const result = (await response.json()) as OpenMeteoResponse;
    const current = result.current;
    if (
      !current ||
      !Number.isFinite(current.temperature_2m) ||
      !Number.isFinite(current.relative_humidity_2m) ||
      !Number.isFinite(current.wind_speed_10m)
    ) {
      throw new Error("Open-Meteo response is incomplete");
    }

    return NextResponse.json({
      data: {
        location: LOCATION.name,
        observedAt: current.time ? `${current.time.replace(/Z$/, "")}Z` : null,
        temperatureC: current.temperature_2m,
        humidityPercent: current.relative_humidity_2m,
        windSpeedKmh: current.wind_speed_10m,
        units: {
          temperature: result.current_units?.temperature_2m ?? "°C",
          humidity: result.current_units?.relative_humidity_2m ?? "%",
          windSpeed: result.current_units?.wind_speed_10m ?? "km/h",
        },
        source: "Open-Meteo",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Data cuaca Kalimantan Tengah sedang tidak tersedia." },
      { status: 503 },
    );
  }
}
