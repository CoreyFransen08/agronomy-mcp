import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import type { Env, FleetioProps } from "./types";
import { FleetioHandler } from "./auth/handler";
import { registerVehicleTools } from "./tools/vehicles";
import { registerMaintenanceTools } from "./tools/maintenance";

export class FleetioMCP extends McpAgent<Env, Record<string, never>, FleetioProps> {
  server = new McpServer({
    name: "fleetio-mcp",
    version: "1.0.0",
  });

  async init() {
    registerVehicleTools(this.server, this.env, this.props!);
    registerMaintenanceTools(this.server, this.env, this.props!);
  }
}

export default new OAuthProvider({
  apiHandler: FleetioMCP.serve("/mcp"),
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: FleetioHandler as any,
  tokenEndpoint: "/token",
});
