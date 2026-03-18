import {
  OPEN_METEO_ARCHIVE_URL,
  OPEN_METEO_FORECAST_URL,
} from "../constants";
import type { DailyTemp } from "../utils/gdu";

// ─── Response types ────────────────────────────────────────────────────

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
  };
}

export interface CurrentWeather {
  time: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayLocal(): string {
  return formatDate(new Date());
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo error (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

function parseDailyTemps(data: OpenMeteoDailyResponse): DailyTemp[] {
  const { time, temperature_2m_max, temperature_2m_min } = data.daily;
  return time.map((date, i) => ({
    date,
    temperatureMax: temperature_2m_max[i],
    temperatureMin: temperature_2m_min[i],
  }));
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Fetch historical daily temps from the archive endpoint.
 * Only works for dates up to yesterday.
 */
export async function fetchArchiveTemps(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<DailyTemp[]> {
  const url =
    `${OPEN_METEO_ARCHIVE_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=auto`;
  const data = await fetchJson<OpenMeteoDailyResponse>(url);
  return parseDailyTemps(data);
}

/**
 * Fetch forecast daily temps (today + up to 14 days).
 * Can also serve recent past via past_days parameter.
 */
export async function fetchForecastTemps(
  latitude: number,
  longitude: number,
  forecastDays = 14,
  pastDays = 0
): Promise<DailyTemp[]> {
  const url =
    `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&forecast_days=${forecastDays}&past_days=${pastDays}` +
    `&temperature_unit=fahrenheit&timezone=auto`;
  const data = await fetchJson<OpenMeteoDailyResponse>(url);
  return parseDailyTemps(data);
}

/**
 * Fetch current weather conditions.
 */
export async function fetchCurrentWeather(
  latitude: number,
  longitude: number
): Promise<CurrentWeather> {
  const url =
    `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
    `&temperature_unit=fahrenheit&timezone=auto`;
  const data = await fetchJson<OpenMeteoCurrentResponse>(url);
  return {
    time: data.current.time,
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    precipitation: data.current.precipitation,
  };
}

/**
 * Fetch daily temps for a date range that may span past and future.
 * Automatically splits between archive (past) and forecast (today+future).
 */
export async function fetchDailyTemps(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<DailyTemp[]> {
  const today = todayLocal();

  // Entirely in the past
  if (endDate < today) {
    return fetchArchiveTemps(latitude, longitude, startDate, endDate);
  }

  // Entirely today or future
  if (startDate >= today) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const forecastDays =
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;

    // Use past_days=0, forecast_days covers the range
    const url =
      `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&temperature_unit=fahrenheit&timezone=auto`;
    const data = await fetchJson<OpenMeteoDailyResponse>(url);
    return parseDailyTemps(data);
  }

  // Spans past → future: split at yesterday / today boundary
  const yesterday = formatDate(
    new Date(new Date(today).getTime() - 86_400_000)
  );

  const [archiveTemps, forecastTemps] = await Promise.all([
    fetchArchiveTemps(latitude, longitude, startDate, yesterday),
    fetchDailyTemps(latitude, longitude, today, endDate),
  ]);

  return [...archiveTemps, ...forecastTemps];
}

/**
 * Fetch archive temps for a specific year, mapping the calendar day range.
 * Used for building 30-year normals.
 */
export async function fetchArchiveTempsForYear(
  latitude: number,
  longitude: number,
  year: number,
  startMonthDay: string, // "MM-DD"
  endMonthDay: string // "MM-DD"
): Promise<DailyTemp[]> {
  const startDate = `${year}-${startMonthDay}`;
  const endDate = `${year}-${endMonthDay}`;
  return fetchArchiveTemps(latitude, longitude, startDate, endDate);
}
