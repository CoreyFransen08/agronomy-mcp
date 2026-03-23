import { CLOUDFLARE_CRAWL_BASE } from "../constants";

interface CrawlCredentials {
  accountId: string;
  apiToken: string;
}

interface StartCrawlParams {
  url: string;
  depth: number;
  limit: number;
  formats: string[];
  render: boolean;
  source: string;
}

interface GetCrawlResultsParams {
  jobId: string;
  limit?: number;
  cursor?: string;
  status?: string;
}

function crawlUrl(accountId: string): string {
  return `${CLOUDFLARE_CRAWL_BASE}/${accountId}/browser-rendering/crawl`;
}

export async function startCrawl(
  creds: CrawlCredentials,
  params: StartCrawlParams
): Promise<unknown> {
  const res = await fetch(crawlUrl(creds.accountId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: params.url,
      depth: params.depth,
      limit: params.limit,
      formats: params.formats,
      render: params.render,
      source: params.source,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudflare crawl API error (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getCrawlResults(
  creds: CrawlCredentials,
  params: GetCrawlResultsParams
): Promise<unknown> {
  const url = new URL(`${crawlUrl(creds.accountId)}/${params.jobId}`);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.status) url.searchParams.set("status", params.status);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Cloudflare crawl results API error (${res.status}): ${body}`
    );
  }

  return res.json();
}

export async function deleteCrawl(
  creds: CrawlCredentials,
  jobId: string
): Promise<unknown> {
  const res = await fetch(`${crawlUrl(creds.accountId)}/${jobId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Cloudflare crawl delete API error (${res.status}): ${body}`
    );
  }

  return res.json();
}
