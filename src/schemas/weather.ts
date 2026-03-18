import { z } from "zod";
import { forceRefreshField } from "./shared";

const locationFields = {
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Latitude in decimal degrees. Required if fipsCode and geojson are not provided."),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Longitude in decimal degrees. Required if fipsCode and geojson are not provided."),
  fipsCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .describe("5-digit US county FIPS code. Alternative to lat/lng."),
  countyName: z
    .string()
    .optional()
    .describe("US county name (e.g. 'Watonwan'). Use with state for best results."),
  state: z
    .string()
    .optional()
    .describe("US state name (e.g. 'Minnesota'). Used with countyName to disambiguate."),
  geojson: z
    .any()
    .optional()
    .describe("GeoJSON Feature with Polygon/MultiPolygon geometry. Centroid will be used."),
};

export const historicalWeatherSchema = z.object({
  ...locationFields,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date (YYYY-MM-DD)."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date (YYYY-MM-DD)."),
  ...forceRefreshField,
});

export const currentWeatherSchema = z.object({
  ...locationFields,
  ...forceRefreshField,
});

export const forecastWeatherSchema = z.object({
  ...locationFields,
  forecastDays: z
    .number()
    .int()
    .min(1)
    .max(16)
    .default(14)
    .describe("Number of forecast days (1-16). Default 14."),
  ...forceRefreshField,
});
