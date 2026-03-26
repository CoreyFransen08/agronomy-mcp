import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import type { Env } from "./types";
import { registerVehicleTools } from "./tools/vehicles";
import { registerMaintenanceTools } from "./tools/maintenance";

export class FleetioMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "fleetio-mcp",
    version: "1.0.0",
  });

  async init() {
    registerVehicleTools(this.server, this.env);
    registerMaintenanceTools(this.server, this.env);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/mcp")) {
      return FleetioMCP.serve("/mcp", { binding: "MCP_OBJECT" }).fetch(
        request,
        env,
        ctx
      );
    }

    if (url.pathname.startsWith("/sse")) {
      return FleetioMCP.serveSSE("/sse", { binding: "MCP_OBJECT" }).fetch(
        request,
        env,
        ctx
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
