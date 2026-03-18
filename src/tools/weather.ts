import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";
import { MAX_RESPONSE_CHARS } from "../constants";
import { cachedFetchAndTransform } from "../services/cache";
import {
  fetchArchiveTemps,
  fetchCurrentWeather,
  fetchForecastTemps,
  fetchDailyTemps,
} from "../services/open-meteo";
import { resolveLocation } from "../utils/geo";
import {
  historicalWeatherSchema,
  currentWeatherSchema,
  forecastWeatherSchema,
} from "../schemas/weather";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function truncate(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length > MAX_RESPONSE_CHARS) {
    return json.slice(0, MAX_RESPONSE_CHARS) + "\n... (truncated)";
  }
  return json;
}

export function registerWeatherTools(server: McpServer, env: Env) {
  // ── get_historical_weather ──────────────────────────────────────────
  server.registerTool(
    "get_historical_weather",
    {
      description:
        "Get historical daily min/max temperatures for a location and date range. " +
        "Accepts lat/lng, FIPS county code, or GeoJSON field boundary.",
      inputSchema: historicalWeatherSchema.shape,
    },
    async (input) => {
      const { startDate, endDate, forceRefresh, ...locInput } =
        historicalWeatherSchema.parse(input);
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_historical_weather",
            params: { ...loc, startDate, endDate },
            forceRefresh,
          },
          () => fetchArchiveTemps(loc.latitude, loc.longitude, startDate, endDate)
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );

  // ── get_current_weather ─────────────────────────────────────────────
  server.registerTool(
    "get_current_weather",
    {
      description:
        "Get current weather conditions (temperature, humidity, wind speed, precipitation) " +
        "for a location. Accepts lat/lng, FIPS county code, or GeoJSON.",
      inputSchema: currentWeatherSchema.shape,
    },
    async (input) => {
      const { forceRefresh, ...locInput } = currentWeatherSchema.parse(input);
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_current_weather",
            params: { ...loc },
            forceRefresh,
          },
          () => fetchCurrentWeather(loc.latitude, loc.longitude)
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );

  // ── get_forecast_weather ────────────────────────────────────────────
  server.registerTool(
    "get_forecast_weather",
    {
      description:
        "Get a 1-16 day daily min/max temperature forecast for a location. " +
        "Accepts lat/lng, FIPS county code, or GeoJSON.",
      inputSchema: forecastWeatherSchema.shape,
    },
    async (input) => {
      const { forecastDays, forceRefresh, ...locInput } =
        forecastWeatherSchema.parse(input);
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_forecast_weather",
            params: { ...loc, forecastDays },
            forceRefresh,
          },
          () => fetchForecastTemps(loc.latitude, loc.longitude, forecastDays)
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );
}
