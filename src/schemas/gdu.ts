import { z } from "zod";
import { forceRefreshField } from "./shared";

const locationFields = {
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Latitude in decimal degrees."),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Longitude in decimal degrees."),
  fipsCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .describe("5-digit US county FIPS code."),
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
    .describe("GeoJSON Feature with Polygon/MultiPolygon geometry."),
};

const gduParamFields = {
  baseTemp: z
    .number()
    .default(50)
    .describe("Base temperature in °F. Default 50 (corn)."),
  upperTemp: z
    .number()
    .default(86)
    .describe("Upper temperature cap in °F. Default 86 (corn)."),
};

export const calculateGduSchema = z.object({
  ...locationFields,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Planting date or start date (YYYY-MM-DD)."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date (YYYY-MM-DD). Defaults to today if omitted.")
    .optional(),
  ...gduParamFields,
  ...forceRefreshField,
});

export const dailyGduSchema = z.object({
  ...locationFields,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("The date to calculate GDU for (YYYY-MM-DD)."),
  ...gduParamFields,
  ...forceRefreshField,
});

export const gduWithDeviationSchema = z.object({
  ...locationFields,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date (YYYY-MM-DD)."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date (YYYY-MM-DD).")
    .optional(),
  ...gduParamFields,
  ...forceRefreshField,
});
