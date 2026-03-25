import { z } from "zod";
import { paginationFields } from "./shared";

export const listServiceRemindersSchema = z.object({
  ...paginationFields,
  filter_vehicle_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by vehicle ID"),
  filter_due_soon: z
    .boolean()
    .optional()
    .describe("Only return reminders that are due soon"),
  filter_overdue: z
    .boolean()
    .optional()
    .describe("Only return reminders that are overdue"),
});

export const listServiceEntriesSchema = z.object({
  ...paginationFields,
  filter_vehicle_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by vehicle ID"),
  filter_started_at_gte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter entries on or after this date (YYYY-MM-DD)"),
  filter_started_at_lte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter entries on or before this date (YYYY-MM-DD)"),
});

export const listWorkOrdersSchema = z.object({
  ...paginationFields,
  filter_vehicle_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by vehicle ID"),
  filter_status: z
    .enum(["open", "completed", "canceled"])
    .optional()
    .describe("Filter by work order status"),
});

export const getWorkOrderSchema = z.object({
  id: z.number().int().positive().describe("Work order ID"),
});

export const listFuelEntriesSchema = z.object({
  ...paginationFields,
  filter_vehicle_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by vehicle ID"),
});

export const listIssuesSchema = z.object({
  ...paginationFields,
  filter_vehicle_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by vehicle ID"),
  filter_state: z
    .enum(["open", "resolved"])
    .optional()
    .describe("Filter by issue state"),
});
