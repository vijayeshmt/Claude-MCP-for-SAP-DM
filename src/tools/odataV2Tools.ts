import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientFactory } from '../clients/clientFactory.js';
import { ODataV2Client } from '../clients/odataV2Client.js';

export function registerODataV2Tools(server: McpServer) {
  server.tool(
    'get_legacy_inventory',
    'Get inventory details from legacy SAP ERP via OData v2. Queries with standard OData filtering.',
    {
      plant: z.string().describe('Plant code, e.g. P001'),
      material: z.string().optional().describe('Material number to filter by'),
      storageLocation: z.string().optional().describe('Storage location code'),
    },
    async ({ plant, material, storageLocation }) => {
      const client = clientFactory.getClient('legacy_inventory') as ODataV2Client;

      // Construct filter dictionary
      const filters = {
        Plant: plant,
        Material: material || undefined,
        StorageLocation: storageLocation || undefined,
      };

      const filterString = client.buildFilter(filters);
      const queryParams: Record<string, string> = {};
      if (filterString) {
        queryParams['$filter'] = filterString;
      }

      try {
        const data = await client.get('/InventorySet', queryParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `OData v2 query failed: ${error.message}` }],
        };
      }
    }
  );
}
