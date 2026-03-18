import centroid from "@turf/centroid";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import {
  COUNTIES,
  FIPS_INDEX,
  NAME_INDEX,
  COUNTY_NAME_INDEX,
} from "../data/fips-coordinates";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
}

export interface LocationInput {
  latitude?: number;
  longitude?: number;
  fipsCode?: string;
  countyName?: string;
  state?: string;
  geojson?: Feature<Geometry, GeoJsonProperties>;
}

/**
 * Resolve a location from lat/lng, FIPS code, county name, or GeoJSON boundary.
 * Priority: lat/lng > fipsCode > countyName > geojson centroid.
 */
export function resolveLocation(input: LocationInput): ResolvedLocation {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  if (input.fipsCode) {
    const idx = FIPS_INDEX.get(input.fipsCode);
    if (idx === undefined) {
      throw new Error(
        `Unknown FIPS code: ${input.fipsCode}. Expected a 5-digit US county FIPS code.`
      );
    }
    const c = COUNTIES[idx];
    return { latitude: c.lat, longitude: c.lng };
  }

  if (input.countyName) {
    const county = input.countyName.toLowerCase().trim();

    // Try exact match with state first
    if (input.state) {
      const state = input.state.toLowerCase().trim();
      const idx = NAME_INDEX.get(`${county}|${state}`);
      if (idx !== undefined) {
        const c = COUNTIES[idx];
        return { latitude: c.lat, longitude: c.lng };
      }
      throw new Error(
        `County "${input.countyName}" not found in state "${input.state}".`
      );
    }

    // Without state — look up by county name alone
    const indices = COUNTY_NAME_INDEX.get(county);
    if (!indices || indices.length === 0) {
      throw new Error(
        `County "${input.countyName}" not found. Try providing a state to narrow results.`
      );
    }
    if (indices.length > 1) {
      const matches = indices.map((i) => `${COUNTIES[i].county}, ${COUNTIES[i].state}`);
      throw new Error(
        `Multiple counties named "${input.countyName}": ${matches.join("; ")}. ` +
        `Please provide a state to disambiguate.`
      );
    }
    const c = COUNTIES[indices[0]];
    return { latitude: c.lat, longitude: c.lng };
  }

  if (input.geojson) {
    const center = centroid(input.geojson);
    const [lng, lat] = center.geometry.coordinates;
    return { latitude: lat, longitude: lng };
  }

  throw new Error(
    "Location required: provide latitude/longitude, fipsCode, countyName, or geojson."
  );
}
