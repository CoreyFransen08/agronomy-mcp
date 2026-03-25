/** Fleetio REST API base URL */
export const FLEETIO_API_BASE = "https://secure.fleetio.com/api";

/** Default page size for list endpoints */
export const DEFAULT_PER_PAGE = 50;

/** Cache key version prefix */
export const CACHE_KEY_VERSION = "v1";

/** Cache TTL in seconds, keyed by tool name */
export const CACHE_TTL: Record<string, number> = {
  list_vehicles: 300,              // 5 min
  get_vehicle: 300,                // 5 min
  list_service_reminders: 300,     // 5 min
  list_service_entries: 600,       // 10 min
  list_work_orders: 600,           // 10 min
  get_work_order: 600,             // 10 min
  list_vehicle_meter_entries: 300,  // 5 min
  list_fuel_entries: 600,          // 10 min
  list_issues: 300,                // 5 min
  get_vehicle_status: 300,         // 5 min
};

/** Maximum characters in a single MCP response */
export const MAX_RESPONSE_CHARS = 500_000;
