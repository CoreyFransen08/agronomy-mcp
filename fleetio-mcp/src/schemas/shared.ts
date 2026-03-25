import { z } from "zod";

export const paginationFields = {
  page: z.number().int().positive().optional().describe("Page number (page-based pagination)"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of records per page (default 50, max 100)"),
  start_cursor: z
    .string()
    .optional()
    .describe("Cursor for keyset pagination (from next_cursor in previous response)"),
  forceRefresh: z.boolean().default(false).describe("Bypass cache and fetch fresh data"),
};
