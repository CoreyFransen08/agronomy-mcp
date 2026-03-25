import { z } from "zod";
import { paginationFields } from "./shared";

export const listVehiclesSchema = z.object({
  ...paginationFields,
  filter_name: z.string().optional().describe("Filter vehicles by name (partial match)"),
  filter_vehicle_status_name: z
    .string()
    .optional()
    .describe("Filter by status (e.g. 'Active', 'Inactive')"),
  filter_group_name: z.string().optional().describe("Filter by group name"),
  filter_vehicle_type_name: z
    .string()
    .optional()
    .describe("Filter by vehicle type (e.g. 'Car', 'Truck')"),
  sort_field: z
    .enum(["name", "created_at", "updated_at", "meter_value"])
    .optional()
    .describe("Field to sort by"),
  sort_direction: z
    .enum(["asc", "desc"])
    .optional()
    .default("asc")
    .describe("Sort direction"),
});

export const getVehicleSchema = z.object({
  id: z.number().int().positive().describe("Fleetio vehicle ID"),
});

export const listVehicleMeterEntriesSchema = z.object({
  vehicle_id: z.number().int().positive().describe("Fleetio vehicle ID"),
  ...paginationFields,
});

export const getVehicleStatusSchema = z.object({
  id: z.number().int().positive().describe("Fleetio vehicle ID"),
});
