# Fleetio MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects to the [Fleetio](https://www.fleetio.com/) fleet management API. Deployed as a Cloudflare Worker using Durable Objects, with KV-based response caching.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare](https://dash.cloudflare.com/) account
- A [Fleetio](https://www.fleetio.com/) account with API access

### Getting Your Fleetio Credentials

1. Log in to Fleetio
2. Navigate to **Account Menu > User Settings**
3. Create a new **API Key** (treat this like a password)
4. Copy your **Account Token** from the account settings

## Setup

```bash
cd fleetio-mcp
npm install
```

### Configure Local Development

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your Fleetio credentials:

```
FLEETIO_API_KEY=your-fleetio-api-key
FLEETIO_ACCOUNT_TOKEN=your-fleetio-account-token
```

### Create KV Namespace

```bash
npx wrangler kv namespace create FLEET_CACHE
```

Copy the output `id` into `wrangler.jsonc` under the `FLEET_CACHE` binding.

### Run Locally

```bash
npm run dev
```

The server starts at `http://localhost:8788`. Verify with:

```bash
curl http://localhost:8788/health
# {"status":"ok"}
```

## Deploy to Cloudflare

```bash
# Set secrets
npx wrangler secret put FLEETIO_API_KEY
npx wrangler secret put FLEETIO_ACCOUNT_TOKEN

# Deploy
npm run deploy
```

## Connecting to the MCP Server

### Claude Code (CLI)

```bash
claude mcp add fleetio --transport http https://fleetio-mcp.<your-subdomain>.workers.dev/mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fleetio": {
      "url": "https://fleetio-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

### SSE Transport (Legacy)

An SSE endpoint is also available at `/sse` for clients that don't support Streamable HTTP.

## Available Tools

### Vehicles

| Tool | Description |
|------|-------------|
| `list_vehicles` | List vehicles with filtering by name, status, group, and type. Supports sorting and pagination. |
| `get_vehicle` | Get full details for a specific vehicle by ID. |
| `get_vehicle_status` | Get current status and key metrics for a vehicle. |
| `list_vehicle_meter_entries` | List odometer and hour-meter entries for a vehicle. |

### Maintenance

| Tool | Description |
|------|-------------|
| `list_service_reminders` | List upcoming and overdue service reminders. Filter by vehicle, due soon, or overdue. |
| `list_service_entries` | List completed maintenance records. Filter by vehicle and date range. |
| `list_work_orders` | List work orders. Filter by vehicle and status (open/completed/canceled). |
| `get_work_order` | Get detailed work order info including line items. |
| `list_fuel_entries` | List fuel transaction records. Filter by vehicle. |
| `list_issues` | List reported issues and unplanned repairs. Filter by vehicle and state (open/resolved). |

## Caching

Responses are cached in Cloudflare KV (`FLEET_CACHE`) to reduce API calls and improve response times. Cache TTLs vary by tool:

- **5 minutes** -- vehicles, service reminders, meter entries, issues, vehicle status
- **10 minutes** -- service entries, work orders, fuel entries

All tools accept a `forceRefresh` parameter to bypass the cache when needed.

## Project Structure

```
fleetio-mcp/
├── src/
│   ├── index.ts              # Worker entry point, route handling
│   ├── types.ts              # Env interface
│   ├── constants.ts          # API base URL, cache TTLs
│   ├── schemas/
│   │   ├── shared.ts         # Pagination fields
│   │   ├── vehicles.ts       # Vehicle tool input schemas
│   │   └── maintenance.ts    # Maintenance tool input schemas
│   ├── services/
│   │   ├── fleetio-api.ts    # Fleetio REST API client
│   │   └── cache.ts          # KV cache wrapper
│   └── tools/
│       ├── vehicles.ts       # Vehicle tool registrations
│       └── maintenance.ts    # Maintenance tool registrations
├── wrangler.jsonc            # Cloudflare Worker config
├── .dev.vars.example         # Local dev secrets template
└── package.json
```

## Future Plans

- Additional Fleetio API endpoints (contacts, parts, inspections)
- Write operations (create/update work orders, service entries)
- KV cache pre-warming for frequently accessed data
- Multi-user OAuth support for shared deployments
