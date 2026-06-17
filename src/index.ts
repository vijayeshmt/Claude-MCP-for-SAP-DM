import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerOrderTools } from './tools/orders.js';
import { registerResourceTools } from './tools/resources.js';
import { registerODataV2Tools } from './tools/odataV2Tools.js';
import { registerODataV4Tools } from './tools/odataV4Tools.js';
import { registerTeamsTools } from './tools/teamsTools.js';

async function main() {
  const server = new McpServer({
    name: 'sap-dmc-multi-protocol',
    version: '1.0.0',
  });

  // Register all tool groups
  registerOrderTools(server);
  registerResourceTools(server);
  registerODataV2Tools(server);
  registerODataV4Tools(server);
  registerTeamsTools(server);

  // Connect server to stdio transport (Claude Desktop standard)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('SAP DMC Multi-Protocol MCP Server running successfully...');
}

main().catch((error) => {
  console.error('Error starting MCP server:', error);
  process.exit(1);
});
