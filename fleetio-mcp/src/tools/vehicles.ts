import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env, FleetioProps } from "../types";
import type { FleetioCredentials } from "../services/fleetio-api";
import { fleetioList, fleetioRequest } from "../services/fleetio-api";
import { cachedFetchAndTransform } from "../services/cache";
import { MAX_RESPONSE_CHARS } from "../constants";
import {
  listVehiclesSchema,
  getVehicleSchema,
  listVehicleMeterEntriesSchema,
  getVehicleStatusSchema,
} from "../schemas/vehicles";

function truncate(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length > MAX_RESPONSE_CHARS) {
    return json.slice(0, MAX_RESPONSE_CHARS) + "\n... (truncated)";
  }
  return json;
}

function buildFilters(input: Record<string, unknown>): Record<string, Record<string, string>> | undefined {
  const filters: Record<string, Record<string, string>> = {};
  for (const [key, val] of Object.entries(input)) {
    if (key.startsWith("filter_") && val !== undefined) {
      const field = key.replace("filter_", "");
      if (typeof val === "boolean") {
        filters[field] = { eq: String(val) };
      } else {
        filters[field] = { eq: String(val) };
      }
    }
  }
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function registerVehicleTools(
  server: McpServer,
  env: Env,
  props: FleetioProps
) {
  const creds: FleetioCredentials = {
    apiKey: props.apiKey,
    accountToken: props.accountToken,
  };

  server.tool(
    "list_vehicles",
    "List vehicles in your Fleetio account. Returns vehicle names, IDs, status, VIN, meter readings, and more. Supports filtering by name, status, group, and type.",
    listVehiclesSchema.shape,
    async (input) => {
      try {
        const parsed = listVehiclesSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_vehicles",
            params: { ...parsed, account: props.accountToken },
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v1/vehicles", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
              sort: parsed.sort_field
                ? { [parsed.sort_field]: parsed.sort_direction ?? "asc" }
                : undefined,
            })
        );
        return { content: [{ type: "text" as const, text: truncate(data) }] };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_vehicle",
    "Get detailed information about a specific vehicle by its Fleetio ID. Returns full vehicle record including specs, status, meter values, group, and custom fields.",
    getVehicleSchema.shape,
    async (input) => {
      try {
        const parsed = getVehicleSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_vehicle",
            params: { id: parsed.id, account: props.accountToken },
            forceRefresh: false,
          },
          () => fleetioRequest(creds, `/v1/vehicles/${parsed.id}`)
        );
        return { content: [{ type: "text" as const, text: truncate(data) }] };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    "list_vehicle_meter_entries",
    "List odometer and hour-meter entries for a specific vehicle. Useful for tracking mileage and usage over time.",
    listVehicleMeterEntriesSchema.shape,
    async (input) => {
      try {
        const parsed = listVehicleMeterEntriesSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_vehicle_meter_entries",
            params: { vehicle_id: parsed.vehicle_id, account: props.accountToken },
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, `/v1/vehicles/${parsed.vehicle_id}/meter_entries`, {
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
            })
        );
        return { content: [{ type: "text" as const, text: truncate(data) }] };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_vehicle_status",
    "Get the current status and key metrics for a specific vehicle, including its latest meter reading, fuel level, and operational status.",
    getVehicleStatusSchema.shape,
    async (input) => {
      try {
        const parsed = getVehicleStatusSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_vehicle_status",
            params: { id: parsed.id, account: props.accountToken },
            forceRefresh: false,
          },
          () => fleetioRequest(creds, `/v1/vehicles/${parsed.id}`)
        );
        return { content: [{ type: "text" as const, text: truncate(data) }] };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      }
    }
  );
}
