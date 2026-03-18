export const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const DEFAULT_BASE_TEMP = 50; // °F — corn base
export const DEFAULT_UPPER_TEMP = 86; // °F — corn upper

export const CACHE_KEY_VERSION = "v1";

/** Cache TTL in seconds, keyed by tool name */
export const CACHE_TTL: Record<string, number> = {
  get_historical_weather: 86_400,   // 24h
  get_current_weather: 3_600,       // 1h
  get_forecast_weather: 14_400,     // 4h
  calculate_gdu: 86_400,            // 24h
  get_daily_gdu: 86_400,            // 24h
  get_gdu_with_deviation: 604_800,  // 7 days
};

/** TTL for individual year normals data cached in KV */
export const NORMALS_YEAR_CACHE_TTL = 2_592_000; // 30 days

export const MAX_RESPONSE_CHARS = 500_000;
