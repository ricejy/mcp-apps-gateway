# Politiloggen MCP App

An [MCP App](https://github.com/modelcontextprotocol/ext-apps) that displays real-time police incidents from Norway's [Politiloggen](https://api.politiloggen.politiet.no) in an interactive React dashboard. Designed to run inside MCP-enabled hosts like Claude Desktop.

## What it does

The server wraps the Norwegian Police's public Politiloggen API and exposes it as an MCP tool with an embedded UI. When a host calls the tool, it renders a dashboard showing:

- **Incident feed** — latest police reports with category, status (active/resolved), description, and location
- **Stats overview** — active vs. resolved counts, number of categories and districts involved
- **Category filtering** — filter incidents by type (traffic, fire, theft, violence, etc.)
- **District filtering** — filter by any of Norway's 12 police districts
- **Manual refresh** — pull the latest data on demand

## Tools

| Tool | Visibility | Description |
|------|-----------|-------------|
| `get-police-incidents` | Model + App | Main tool — fetches incidents with optional district/category filters |
| `refresh-incidents` | App only | Called by the UI's refresh button and filter changes |
| `get-filter-options` | App only | Loads available categories and districts for the filter dropdowns |

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

This starts the MCP server on `http://localhost:3001/mcp` with hot-reload for both the UI and server.

Other commands:

```bash
npm run build   # Production build
npm run start   # Build + serve
npm run serve   # Serve only (after build)
```

### Connect to a host

**Claude Desktop** — add to your MCP server config:

```json
{
  "mcpServers": {
    "politiloggen": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**basic-host** (for local testing):

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps && npm install
cd examples/basic-host
SERVERS='["http://localhost:3001/mcp"]' npm run start
# Open http://localhost:8080
```

**stdio** — for hosts that use stdio transport:

```bash
npm run build
node dist/index.js --stdio
```

## Project structure

```
server.ts          MCP server — tools and resource registration
main.ts            Entry point — HTTP and stdio transports
src/mcp-app.tsx    React dashboard UI
src/global.css     Theme-aware CSS variables (adapts to host theme)
mcp-app.html       HTML entry point (bundled into single file by Vite)
vite.config.ts     Vite config with vite-plugin-singlefile
```

## Data source

All data comes from the Norwegian Police's public API at `api.politiloggen.politiet.no`, licensed under [NLOD 2.0](https://data.norge.no/nlod/no/2.0).

## License

MIT
