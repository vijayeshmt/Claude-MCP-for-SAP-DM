# SAP Digital Manufacturing (DMC) MCP Server

A Multi-Protocol Model Context Protocol (MCP) server for SAP Digital Manufacturing (DMC) to enable AI-powered manufacturing operations analysis, automated report generation, and direct delivery to MS Teams via a webhook.

## Features

- **Multi-Protocol Support**: Implements REST, OData V2, and OData V4 client layers.
- **Dynamic Extractor Column Discovery**: Auto-detects schemas for all 53 OData V4 extractor entities.
- **10 Specialized MCP Tools**: Registered query tools for orders, labor_schedules, sfcs, workcenters, resources, materials, boms, downtimes, order_schedules, and production_events (with pagination).
- **Automated MS Teams Reports**: Triggers high-quality, print-ready HTML/Markdown report generation and pushes payloads directly to a Microsoft Teams webhook via Power Automate.
- **Auto Timezone Conversion**: Converts all UTC timestamps to India Standard Time (IST, UTC+5:30) for easy operations tracking.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Claude Desktop](https://claude.ai/download) (or another MCP-compliant client)

### Setup & Installation

1. **Clone this repository** to your local machine.
2. **Configure Environment Variables**:
   - Copy `.env.example` to a new file named `.env`.
   - Update the configuration values with your SAP BTP credentials:
     ```env
     DMC_API_ENDPOINT=https://<your-tenant>.dmc.cloud.sap
     DMC_TOKEN_URL=https://<your-auth-url>/oauth/token
     DMC_CLIENT_ID=<your-client-id>
     DMC_CLIENT_SECRET=<your-client-secret>
     DMC_PLANT=VIJ_01
     ```
3. **Register with Claude Desktop**:
   Run the automatic installer script from the root folder:
   ```bash
   node install.js
   ```
   This will install dependencies, compile the TypeScript code, and register the server config inside Claude Desktop's configuration file.
4. **Restart Claude Desktop**:
   - Completely quit Claude Desktop from the system tray (right-click the Claude icon -> Quit).
   - Reopen Claude Desktop.
   - The MCP tools are now available for use!
