import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  CACHE: KVNamespace;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_PROVIDER: OAuthHelpers;
}

/** Encrypted props stored inside the OAuth access token */
export type FleetioProps = {
  /** Fleetio API key (passed as Authorization: Token <key>) */
  apiKey: string;
  /** Fleetio account token (passed as Account-Token header) */
  accountToken: string;
  /** Display label the user provided during auth */
  label: string;
  [key: string]: unknown;
};
