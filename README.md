# Agronomy MCP

An agronomy-focused [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server built on Cloudflare Workers. Provides AI agents with weather data and Growing Degree Unit (GDU) calculations for any US location.

Replaces the manual workflow of pulling temperature data from various sources and running GDU calculations in spreadsheets one county at a time.

## Tools

### Weather

| Tool | Description | Cache TTL |
|------|-------------|-----------|
| `get_historical_weather` | Daily min/max temperatures for a date range | 24h |
| `get_current_weather` | Current conditions (temp, humidity, wind, precip) | 1h |
| `get_forecast_weather` | 1-16 day daily min/max temperature forecast | 4h |

### Growing Degree Units (GDU)

| Tool | Description | Cache TTL |
|------|-------------|-----------|
| `calculate_gdu` | Cumulative GDU from a planting/start date to an end date | 24h |
| `get_daily_gdu` | GDU for a single day | 24h |
| `get_gdu_with_deviation` | GDU + deviation from 30-year normal (1994-2023) | 7 days |

GDU tools default to standard corn parameters (base 50F, upper 86F) but accept custom values for other crops.

### GDU Formula

```
cappedMax   = min(Tmax, upperTemp)
adjustedMin = max(Tmin, baseTemp)
dailyGDU    = max(((cappedMax + adjustedMin) / 2) - baseTemp, 0)
```

## Location Resolution

All tools accept location via any of these methods (resolved in this order):

| Method | Parameters | Example |
|--------|-----------|---------|
| Coordinates | `latitude`, `longitude` | `41.88, -93.10` |
| FIPS code | `fipsCode` | `"19169"` (Story County, IA) |
| County name | `countyName`, `state` | `"Watonwan"`, `"Minnesota"` |
| Field boundary | `geojson` | GeoJSON Feature with Polygon geometry |

County name lookup uses centroid coordinates from US Census geometries. When a county name exists in multiple states (e.g. "Washington"), the `state` parameter is required to disambiguate.

The FIPS dataset includes ~3,220 US counties.

## Data Sources

- **Weather**: [Open-Meteo API](https://open-meteo.com/) (free, no API key required)
  - Archive endpoint for historical data
  - Forecast endpoint for current + future data
  - Automatic date-range splitting when a request spans past and future
- **County centroids**: US Census Bureau county geometries via PostGIS `ST_Centroid`

## Architecture

- **Runtime**: Cloudflare Workers + Durable Objects
- **MCP SDK**: `@modelcontextprotocol/sdk` via [`agents`](https://www.npmjs.com/package/agents) (Cloudflare Agents SDK)
- **Caching**: Cloudflare KV with per-tool TTLs. All tools support `forceRefresh: true` to bypass cache.
- **GeoJSON centroid**: `@turf/centroid`

## Setup

```bash
npm install
```

Create a KV namespace and update the ID in `wrangler.jsonc`:

```bash
npx wrangler kv namespace create CACHE
```

## Development

```bash
npm run dev
```

Endpoints:

- `GET /health` — health check
- `/mcp` — MCP protocol (Streamable HTTP)
- `/sse` — MCP protocol (SSE transport)

Connect with [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) or any MCP-compatible client.

## Deploy

```bash
npm run deploy
```

## Type Check

```bash
npm run typecheck
```

## License

MIT
