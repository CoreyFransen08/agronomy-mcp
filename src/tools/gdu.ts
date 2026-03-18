import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";
import { MAX_RESPONSE_CHARS, NORMALS_YEAR_CACHE_TTL } from "../constants";
import { cachedFetchAndTransform } from "../services/cache";
import { fetchDailyTemps, fetchArchiveTempsForYear } from "../services/open-meteo";
import { resolveLocation } from "../utils/geo";
import {
  calculateCumulativeGdu,
  calculateDailyGdu,
  averageDailyGduAcrossYears,
  type DailyTemp,
} from "../utils/gdu";
import {
  calculateGduSchema,
  dailyGduSchema,
  gduWithDeviationSchema,
} from "../schemas/gdu";

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

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch 30-year normals (1994-2023) for a calendar day range.
 * Each year is cached individually in KV for reuse.
 */
async function fetch30YearNormals(
  kv: KVNamespace,
  latitude: number,
  longitude: number,
  startMonthDay: string,
  endMonthDay: string,
  forceRefresh: boolean
): Promise<DailyTemp[][]> {
  const startYear = 1994;
  const endYear = 2023;
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  );

  // Fetch in batches of 5 to respect Workers subrequest limits
  const batchSize = 5;
  const allYearData: DailyTemp[][] = [];

  for (let i = 0; i < years.length; i += batchSize) {
    const batch = years.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (year) => {
        const cacheKey = `v1:normals:${latitude},${longitude}:${year}:${startMonthDay}:${endMonthDay}`;

        if (!forceRefresh) {
          const cached = await kv.get<DailyTemp[]>(cacheKey, "json");
          if (cached !== null) return cached;
        }

        const data = await fetchArchiveTempsForYear(
          latitude,
          longitude,
          year,
          startMonthDay,
          endMonthDay
        );

        await kv.put(cacheKey, JSON.stringify(data), {
          expirationTtl: NORMALS_YEAR_CACHE_TTL,
        });

        return data;
      })
    );
    allYearData.push(...results);
  }

  return allYearData;
}

export function registerGduTools(server: McpServer, env: Env) {
  // ── calculate_gdu ───────────────────────────────────────────────────
  server.registerTool(
    "calculate_gdu",
    {
      description:
        "Calculate cumulative Growing Degree Units (GDU) from a planting/start date to an end date. " +
        "Returns daily and cumulative GDU. Accepts lat/lng, FIPS code, or GeoJSON.",
      inputSchema: calculateGduSchema.shape,
    },
    async (input) => {
      const { startDate, endDate: rawEnd, baseTemp, upperTemp, forceRefresh, ...locInput } =
        calculateGduSchema.parse(input);
      const endDate = rawEnd ?? todayStr();
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "calculate_gdu",
            params: { ...loc, startDate, endDate, baseTemp, upperTemp },
            forceRefresh,
          },
          async () => {
            const temps = await fetchDailyTemps(
              loc.latitude,
              loc.longitude,
              startDate,
              endDate
            );
            return calculateCumulativeGdu(temps, baseTemp, upperTemp);
          }
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

  // ── get_daily_gdu ───────────────────────────────────────────────────
  server.registerTool(
    "get_daily_gdu",
    {
      description:
        "Get the GDU value for a single day. " +
        "Accepts lat/lng, FIPS code, or GeoJSON.",
      inputSchema: dailyGduSchema.shape,
    },
    async (input) => {
      const { date, baseTemp, upperTemp, forceRefresh, ...locInput } =
        dailyGduSchema.parse(input);
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_daily_gdu",
            params: { ...loc, date, baseTemp, upperTemp },
            forceRefresh,
          },
          async () => {
            const temps = await fetchDailyTemps(
              loc.latitude,
              loc.longitude,
              date,
              date
            );
            if (temps.length === 0) {
              throw new Error(`No temperature data available for ${date}`);
            }
            const t = temps[0];
            const gdu = calculateDailyGdu(
              t.temperatureMax,
              t.temperatureMin,
              baseTemp,
              upperTemp
            );
            return {
              date,
              temperatureMax: t.temperatureMax,
              temperatureMin: t.temperatureMin,
              gdu: Math.round(gdu * 10) / 10,
              baseTemp,
              upperTemp,
            };
          }
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

  // ── get_gdu_with_deviation ──────────────────────────────────────────
  server.registerTool(
    "get_gdu_with_deviation",
    {
      description:
        "Calculate GDU for a date range and compare against the 30-year normal (1994-2023). " +
        "Returns actual GDU, normal GDU, and the deviation. " +
        "Accepts lat/lng, FIPS code, or GeoJSON.",
      inputSchema: gduWithDeviationSchema.shape,
    },
    async (input) => {
      const {
        startDate,
        endDate: rawEnd,
        baseTemp,
        upperTemp,
        forceRefresh,
        ...locInput
      } = gduWithDeviationSchema.parse(input);
      const endDate = rawEnd ?? todayStr();
      try {
        const loc = resolveLocation(locInput);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_gdu_with_deviation",
            params: { ...loc, startDate, endDate, baseTemp, upperTemp },
            forceRefresh,
          },
          async () => {
            // Fetch actual temps
            const actualTemps = await fetchDailyTemps(
              loc.latitude,
              loc.longitude,
              startDate,
              endDate
            );
            const actual = calculateCumulativeGdu(
              actualTemps,
              baseTemp,
              upperTemp
            );

            // Extract MM-DD for normals lookup
            const startMonthDay = startDate.slice(5); // "MM-DD"
            const endMonthDay = endDate.slice(5);

            // Fetch 30-year normals
            const yearlyData = await fetch30YearNormals(
              env.CACHE,
              loc.latitude,
              loc.longitude,
              startMonthDay,
              endMonthDay,
              forceRefresh
            );

            const normals = averageDailyGduAcrossYears(
              yearlyData,
              baseTemp,
              upperTemp
            );

            const deviation =
              Math.round((actual.cumulativeGdu - normals.cumulativeNormal) * 10) / 10;

            return {
              actual: {
                cumulativeGdu: actual.cumulativeGdu,
                days: actual.days,
              },
              normal: {
                cumulativeGdu: normals.cumulativeNormal,
                averageDailyGdus: normals.averageDailyGdus,
              },
              deviation,
              deviationPercent:
                normals.cumulativeNormal > 0
                  ? Math.round(
                      (deviation / normals.cumulativeNormal) * 1000
                    ) / 10
                  : 0,
              startDate,
              endDate,
              baseTemp,
              upperTemp,
            };
          }
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
