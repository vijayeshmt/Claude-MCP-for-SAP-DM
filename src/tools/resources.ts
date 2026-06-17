import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientFactory } from '../clients/clientFactory.js';
import { RestClient } from '../clients/restClient.js';
import { ODataV4Client } from '../clients/odataV4Client.js';
import { env } from '../config.js';

export function registerResourceTools(server: McpServer) {
  server.tool(
    'get_resources',
    'Get manufacturing resources / equipment in a plant.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      status: z.enum(['UP', 'DOWN', 'STANDBY', 'UNKNOWN']).optional().describe('Filter by resource status'),
    },
    async ({ plant, status }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      // 1. Try standard REST endpoint
      try {
        const restClient = clientFactory.getClient('dmc_resources') as RestClient;
        const queryParams: Record<string, string> = { plant: activePlant };
        if (status) queryParams.status = status;

        const data = await restClient.get('/resources', queryParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (restError: any) {
        console.warn(`[get_resources REST Failed] Falling back to OData v4 RESOURCE extractor:`, restError.message);
        
        // 2. Fall back to OData v4 RESOURCE extractor
        try {
          const extractorClient = clientFactory.getClient('dmci_extractor') as ODataV4Client;
          const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
          if (status) {
            filterParts.push(`STATUS eq '${status}'`);
          }

          const data = await extractorClient.get('/RESOURCE', {
            $filter: filterParts.join(' and '),
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          };
        } catch (extractorError: any) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to fetch resources (both REST and Extractor failed): ${extractorError.message}` }],
          };
        }
      }
    }
  );

  server.tool(
    'get_resource_status',
    'Get status and details of a specific resource.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      resource: z.string().describe('Resource ID/Name'),
    },
    async ({ plant, resource }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      // 1. Try standard REST endpoint
      try {
        const restClient = clientFactory.getClient('dmc_resources') as RestClient;
        const data = await restClient.get(`/resources/${resource}`, { plant: activePlant });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (restError: any) {
        console.warn(`[get_resource_status REST Failed] Falling back to OData v4 RESOURCE extractor:`, restError.message);
        
        // 2. Fall back to OData v4 RESOURCE extractor
        try {
          const extractorClient = clientFactory.getClient('dmci_extractor') as ODataV4Client;
          const filter = `PLANT eq '${activePlant.replace(/'/g, "''")}' and RESOURCE eq '${resource.replace(/'/g, "''")}'`;
          
          const data = await extractorClient.get('/RESOURCE', { $filter: filter });
          const item = Array.isArray(data) && data.length > 0 ? data[0] : null;
          
          if (!item) {
            throw new Error(`Resource ${resource} not found in plant ${activePlant}`);
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(item, null, 2) }],
          };
        } catch (extractorError: any) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to fetch resource status (both REST and Extractor failed): ${extractorError.message}` }],
          };
        }
      }
    }
  );
}
