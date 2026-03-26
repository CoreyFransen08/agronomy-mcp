import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";
import { fleetioList, fleetioRequest } from "../services/fleetio-api";
import { cachedFetchAndTransform } from "../services/cache";
import { MAX_RESPONSE_CHARS } from "../constants";
import {
  listServiceRemindersSchema,
  listServiceEntriesSchema,
  listWorkOrdersSchema,
  getWorkOrderSchema,
  listFuelEntriesSchema,
  listIssuesSchema,
} from "../schemas/maintenance";

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
      if (field.endsWith("_gte")) {
        const realField = field.replace(/_gte$/, "");
        filters[realField] = { ...filters[realField], gte: String(val) };
      } else if (field.endsWith("_lte")) {
        const realField = field.replace(/_lte$/, "");
        filters[realField] = { ...filters[realField], lte: String(val) };
      } else {
        filters[field] = { eq: String(val) };
      }
    }
  }
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function registerMaintenanceTools(server: McpServer, env: Env) {
  const creds = {
    apiKey: env.FLEETIO_API_KEY,
    accountToken: env.FLEETIO_ACCOUNT_TOKEN,
  };

  server.tool(
    "list_service_reminders",
    "List upcoming and overdue service reminders. Service reminders alert you when scheduled maintenance tasks are due soon or overdue, based on time or meter intervals. Useful for understanding what maintenance is coming up across your fleet.",
    listServiceRemindersSchema.shape,
    async (input) => {
      try {
        const parsed = listServiceRemindersSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_service_reminders",
            params: parsed,
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v1/service_reminders", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
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
    "list_service_entries",
    "List completed service/maintenance entries. Service entries record completed preventative maintenance and one-time repairs performed on vehicles. Filter by vehicle, date range, etc.",
    listServiceEntriesSchema.shape,
    async (input) => {
      try {
        const parsed = listServiceEntriesSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_service_entries",
            params: parsed,
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v2/service_entries", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
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
    "list_work_orders",
    "List work orders. Work orders provide detailed tracking for service tasks and issues, including the full lifecycle from creation through completion. Filter by vehicle, status (open/completed/canceled).",
    listWorkOrdersSchema.shape,
    async (input) => {
      try {
        const parsed = listWorkOrdersSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_work_orders",
            params: parsed,
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v1/work_orders", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
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
    "get_work_order",
    "Get detailed information about a specific work order, including line items, associated vehicle, status, and completion details.",
    getWorkOrderSchema.shape,
    async (input) => {
      try {
        const parsed = getWorkOrderSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "get_work_order",
            params: { id: parsed.id },
            forceRefresh: false,
          },
          () => fleetioRequest(creds, `/v1/work_orders/${parsed.id}`)
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
    "list_fuel_entries",
    "List fuel entries (fuel-up transactions). Each entry includes vendor, cost, gallons, price per gallon, odometer reading, and associated vehicle. Useful for fuel cost analysis and consumption tracking.",
    listFuelEntriesSchema.shape,
    async (input) => {
      try {
        const parsed = listFuelEntriesSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_fuel_entries",
            params: parsed,
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v1/fuel_entries", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
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
    "list_issues",
    "List reported issues (unexpected problems and one-time repairs). Issues track unplanned problems that don't fit routine preventative maintenance. Filter by vehicle and state (open/resolved).",
    listIssuesSchema.shape,
    async (input) => {
      try {
        const parsed = listIssuesSchema.parse(input);
        const data = await cachedFetchAndTransform(
          {
            kv: env.CACHE,
            toolName: "list_issues",
            params: parsed,
            forceRefresh: parsed.forceRefresh,
          },
          () =>
            fleetioList(creds, "/v1/issues", {
              page: parsed.page,
              per_page: parsed.per_page,
              start_cursor: parsed.start_cursor,
              filter: buildFilters(parsed),
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
}
