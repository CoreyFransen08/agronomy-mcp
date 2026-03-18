import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import type { Env } from "./types";
import { registerWeatherTools } from "./tools/weather";
import { registerGduTools } from "./tools/gdu";

export class AgronomyMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "agdata",
    version: "1.0.0",
  });

  async init() {
    registerWeatherTools(this.server, this.env);
    registerGduTools(this.server, this.env);
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
      return AgronomyMCP.serve("/mcp", { binding: "MCP_OBJECT" }).fetch(
        request,
        env,
        ctx
      );
    }

    if (url.pathname.startsWith("/sse")) {
      return AgronomyMCP.serveSSE("/sse", { binding: "MCP_OBJECT" }).fetch(
        request,
        env,
        ctx
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
