/**
 * Constructs an upstream authorize URL with query parameters.
 */
export function getUpstreamAuthorizeUrl(opts: {
  upstream_url: string;
  client_id: string;
  scope: string;
  redirect_uri: string;
  state?: string;
}): string {
  const url = new URL(opts.upstream_url);
  url.searchParams.set("client_id", opts.client_id);
  url.searchParams.set("redirect_uri", opts.redirect_uri);
  url.searchParams.set("scope", opts.scope);
  if (opts.state) url.searchParams.set("state", opts.state);
  url.searchParams.set("response_type", "code");
  return url.href;
}

/**
 * Exchange an authorization code for an upstream access token.
 * Returns [token, null] on success or [null, Response] on failure.
 */
export async function fetchUpstreamAuthToken(opts: {
  code: string | undefined;
  upstream_url: string;
  client_secret: string;
  redirect_uri: string;
  client_id: string;
}): Promise<[string, null] | [null, Response]> {
  if (!opts.code) {
    return [null, new Response("Missing code", { status: 400 })];
  }

  const resp = await fetch(opts.upstream_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.client_id,
      client_secret: opts.client_secret,
      code: opts.code,
      redirect_uri: opts.redirect_uri,
    }).toString(),
  });

  if (!resp.ok) {
    return [null, new Response("Failed to fetch access token", { status: 500 })];
  }

  const body = await resp.formData();
  const accessToken = body.get("access_token") as string;
  if (!accessToken) {
    return [null, new Response("Missing access token", { status: 400 })];
  }
  return [accessToken, null];
}

/** Props stored in the OAuth token, available as McpAgent.props */
export type Props = {
  apiKey: string;
  accountToken: string;
  label: string;
};
