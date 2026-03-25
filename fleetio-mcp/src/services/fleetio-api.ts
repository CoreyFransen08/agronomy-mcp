import { FLEETIO_API_BASE, DEFAULT_PER_PAGE } from "../constants";

export interface FleetioCredentials {
  apiKey: string;
  accountToken: string;
}

export interface FleetioListParams {
  page?: number;
  per_page?: number;
  /** Cursor-based pagination (newer endpoints) */
  start_cursor?: string;
  /** Filter parameters, e.g. { "name": { "like": "Tundra" } } */
  filter?: Record<string, Record<string, string>>;
  /** Sort parameters, e.g. { "name": "asc" } */
  sort?: Record<string, string>;
}

function buildQueryString(params: FleetioListParams): string {
  const qs = new URLSearchParams();

  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.start_cursor) qs.set("start_cursor", params.start_cursor);

  if (params.filter) {
    for (const [field, ops] of Object.entries(params.filter)) {
      for (const [op, val] of Object.entries(ops)) {
        qs.set(`filter[${field}][${op}]`, val);
      }
    }
  }

  if (params.sort) {
    for (const [field, dir] of Object.entries(params.sort)) {
      qs.set(`sort[${field}]`, dir);
    }
  }

  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function fleetioRequest<T>(
  creds: FleetioCredentials,
  path: string,
  listParams?: FleetioListParams
): Promise<T> {
  const queryString = listParams ? buildQueryString(listParams) : "";
  const url = `${FLEETIO_API_BASE}${path}${queryString}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Token ${creds.apiKey}`,
      "Account-Token": creds.accountToken,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(
      `Fleetio API error ${resp.status}: ${body}`
    );
  }

  return resp.json() as Promise<T>;
}

/** Convenience: list with default per_page */
export async function fleetioList<T>(
  creds: FleetioCredentials,
  path: string,
  params: FleetioListParams = {}
): Promise<T> {
  return fleetioRequest<T>(creds, path, {
    per_page: DEFAULT_PER_PAGE,
    ...params,
  });
}
