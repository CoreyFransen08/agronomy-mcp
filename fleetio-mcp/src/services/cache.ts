import { CACHE_KEY_VERSION, CACHE_TTL } from "../constants";

export interface CacheOptions {
  kv: KVNamespace;
  toolName: string;
  params: Record<string, unknown>;
  forceRefresh: boolean;
}

function buildCacheKey(
  toolName: string,
  params: Record<string, unknown>
): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined) acc[k] = params[k];
      return acc;
    }, {});
  return `${CACHE_KEY_VERSION}:${toolName}:${JSON.stringify(sorted)}`;
}

export async function cachedFetchAndTransform<T>(
  opts: CacheOptions,
  fetchAndTransform: () => Promise<T>
): Promise<T> {
  const key = buildCacheKey(opts.toolName, opts.params);
  const ttl = CACHE_TTL[opts.toolName];

  if (!opts.forceRefresh) {
    const cached = await opts.kv.get<T>(key, "json");
    if (cached !== null) return cached;
  }

  const data = await fetchAndTransform();
  if (ttl) {
    await opts.kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
  }
  return data;
}
