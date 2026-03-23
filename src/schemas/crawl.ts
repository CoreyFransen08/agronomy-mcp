import { z } from "zod";

export const startCrawlSchema = z.object({
  url: z
    .string()
    .url()
    .describe("The URL to start crawling from (e.g. 'https://example.com')."),
  depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2)
    .describe(
      "Maximum number of levels deep the crawler will traverse from the starting URL. Default 2."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(25)
    .describe("Maximum number of pages to crawl. Default 25."),
  formats: z
    .array(z.enum(["html", "markdown", "json"]))
    .default(["markdown"])
    .describe(
      "Output formats to return per page. Options: html, markdown, json. Default ['markdown']."
    ),
  render: z
    .boolean()
    .default(false)
    .describe(
      "Set true to render pages in a real browser (for JS-heavy/SPA sites). " +
        "Set false for a simple HTTP fetch (faster, for static sites). Default false."
    ),
  source: z
    .enum(["all", "sitemaps", "links"])
    .default("all")
    .describe(
      "How to discover URLs. 'all' uses sitemaps + page links, " +
        "'sitemaps' only crawls sitemap URLs, 'links' only follows page links. Default 'all'."
    ),
});

export const deleteCrawlSchema = z.object({
  jobId: z.string().describe("The crawl job ID to cancel."),
});

export const getCrawlResultsSchema = z.object({
  jobId: z.string().describe("The crawl job ID returned by start_crawl."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Number of page results to return. Default 10."),
  cursor: z
    .string()
    .optional()
    .describe(
      "Pagination cursor from a previous response. Pass to retrieve the next page of results."
    ),
  status: z
    .enum(["queued", "completed", "disallowed", "skipped", "errored", "cancelled"])
    .optional()
    .describe("Filter results by record status."),
});
