import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../types";
import { MAX_RESPONSE_CHARS } from "../constants";
import {
  startCrawl as startCrawlApi,
  getCrawlResults as getCrawlResultsApi,
  deleteCrawl as deleteCrawlApi,
} from "../services/cloudflare-crawl";
import { startCrawlSchema, deleteCrawlSchema, getCrawlResultsSchema } from "../schemas/crawl";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function truncate(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length > MAX_RESPONSE_CHARS) {
    return json.slice(0, MAX_RESPONSE_CHARS) + "\n... (truncated)";
  }
  return json;
}

export function registerCrawlTools(server: McpServer, env: Env) {
  // ── start_crawl ─────────────────────────────────────────────────────
  server.registerTool(
    "start_crawl",
    {
      description:
        "Start an async crawl of a website using the Cloudflare Browser Rendering API. " +
        "Returns a job ID to poll with get_crawl_results. " +
        "Supports configurable depth, page limit, output formats (html/markdown/json), " +
        "and browser rendering for JS-heavy sites.",
      inputSchema: startCrawlSchema.shape,
    },
    async (input) => {
      const params = startCrawlSchema.parse(input);
      try {
        const data = await startCrawlApi(
          {
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
          },
          params
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );

  // ── delete_crawl ───────────────────────────────────────────────────
  server.registerTool(
    "delete_crawl",
    {
      description:
        "Cancel a running crawl job. Use this to stop a crawl that is no longer needed.",
      inputSchema: deleteCrawlSchema.shape,
    },
    async (input) => {
      const { jobId } = deleteCrawlSchema.parse(input);
      try {
        const data = await deleteCrawlApi(
          {
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
          },
          jobId
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );

  // ── get_crawl_results ───────────────────────────────────────────────
  server.registerTool(
    "get_crawl_results",
    {
      description:
        "Retrieve results of a crawl job started with start_crawl. " +
        "Returns the job status and crawled page content. " +
        "If the job is still running, call again later. " +
        "Supports pagination via cursor and filtering by record status.",
      inputSchema: getCrawlResultsSchema.shape,
    },
    async (input) => {
      const params = getCrawlResultsSchema.parse(input);
      try {
        const data = await getCrawlResultsApi(
          {
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            apiToken: env.CLOUDFLARE_API_TOKEN,
          },
          params
        );
        return {
          content: [{ type: "text" as const, text: truncate(data) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${errorMessage(error)}` },
          ],
        };
      }
    }
  );
}
