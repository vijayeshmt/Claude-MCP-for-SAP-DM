import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientFactory } from '../clients/clientFactory.js';
import { RestClient } from '../clients/restClient.js';
import { ODataV4Client } from '../clients/odataV4Client.js';
import { env } from '../config.js';

export function registerOrderTools(server: McpServer) {
  server.tool(
    'get_production_orders',
    'Get production orders from SAP DMC. Supports filtering, sorting by date, and limiting results (e.g., to find the most recent orders or a specific time range).',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      status: z.enum(['NEW', 'RELEASED', 'ACTIVE', 'COMPLETE', 'COMPLETED']).optional().describe('Filter by order status'),
      material: z.string().optional().describe('Filter by material number'),
      updatedSince: z.string().optional().describe('Filter for orders updated since this timestamp (ISO 8601, e.g. 2026-05-20T00:00:00Z)'),
      updatedBefore: z.string().optional().describe('Filter for orders updated before this timestamp (ISO 8601, e.g. 2026-05-22T23:59:59Z)'),
      orderBy: z.string().optional().describe('Field to sort by, e.g. "LAST_UPDATED_AT desc" to get the most recent orders first'),
      top: z.number().optional().describe('Limit the number of returned records (useful for getting the most recent N orders)'),
    },
    async ({ plant, status, material, updatedSince, updatedBefore, orderBy, top }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      // 1. Try standard REST endpoint
      try {
        const restClient = clientFactory.getClient('dmc_orders') as RestClient;
        const queryParams: Record<string, string> = { plant: activePlant };
        if (status) queryParams.status = status;
        if (material) queryParams.material = material;
        if (top) queryParams.top = top.toString();

        const data = await restClient.get('/orders', queryParams);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (restError: any) {
        console.warn(`[get_production_orders REST Failed] Falling back to OData v4 ORDER extractor:`, restError.message);
        
        // 2. Fall back to OData v4 ORDER extractor (supporting full OData ordering & filtering)
        try {
          const extractorClient = clientFactory.getClient('dmci_extractor') as ODataV4Client;
          const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
          
          if (status) {
            // Map status values to appropriate extractor fields
            if (status === 'RELEASED') {
              filterParts.push("RELEASE_STATUS eq 'RELEASED'");
            } else if (status === 'ACTIVE') {
              filterParts.push("EXECUTION_STATUS eq 'ACTIVE'");
            } else if (status === 'COMPLETE' || status === 'COMPLETED') {
              filterParts.push("EXECUTION_STATUS eq 'COMPLETED'");
            } else {
              filterParts.push(`EXECUTION_STATUS eq '${status}'`);
            }
          }
          
          if (material) {
            filterParts.push(`MATERIAL eq '${material.replace(/'/g, "''")}'`);
          }
          
          if (updatedSince) {
            // ISO Date/Time filter on LAST_UPDATED_AT
            filterParts.push(`LAST_UPDATED_AT ge ${updatedSince}`);
          }
          if (updatedBefore) {
            filterParts.push(`LAST_UPDATED_AT le ${updatedBefore}`);
          }

          const queryParams: Record<string, string> = {
            $filter: filterParts.join(' and '),
          };

          if (orderBy) {
            queryParams['$orderby'] = orderBy;
          }
          if (top !== undefined) {
            queryParams['$top'] = top.toString();
          }

          const data = await extractorClient.get('/ORDER', queryParams);
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          };
        } catch (extractorError: any) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to fetch production orders (both REST and Extractor failed): ${extractorError.message}` }],
          };
        }
      }
    }
  );

  server.tool(
    'get_order_details',
    'Get full details of a specific production order by order number.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      order: z.string().describe('Order number/ID'),
    },
    async ({ plant, order }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      // 1. Try standard REST endpoint
      try {
        const restClient = clientFactory.getClient('dmc_orders') as RestClient;
        const data = await restClient.get(`/orders/${order}`, { plant: activePlant });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (restError: any) {
        console.warn(`[get_order_details REST Failed] Falling back to OData v4 ORDER extractor:`, restError.message);
        
        // 2. Fall back to OData v4 ORDER extractor
        try {
          const extractorClient = clientFactory.getClient('dmci_extractor') as ODataV4Client;
          const filter = `PLANT eq '${activePlant.replace(/'/g, "''")}' and ORDER eq '${order.replace(/'/g, "''")}'`;
          
          const data = await extractorClient.get('/ORDER', { $filter: filter });
          const item = Array.isArray(data) && data.length > 0 ? data[0] : null;
          
          if (!item) {
            throw new Error(`Order ${order} not found in plant ${activePlant}`);
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(item, null, 2) }],
          };
        } catch (extractorError: any) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to fetch order details (both REST and Extractor failed): ${extractorError.message}` }],
          };
        }
      }
    }
  );
}
