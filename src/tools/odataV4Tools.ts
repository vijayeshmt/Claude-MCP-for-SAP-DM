import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientFactory } from '../clients/clientFactory.js';
import { ODataV4Client } from '../clients/odataV4Client.js';
import { extractorMetadata } from './extractor_metadata.js';
import { formatPaginatedResult } from './paginationHelper.js';
import { env } from '../config.js';

export function registerODataV4Tools(server: McpServer) {
  // Generic tool to retrieve records for a Managed Data Object (MDO)
  server.tool(
    'get_custom_mdo_records',
    'Retrieve records for a Managed Data Object (MDO) in SAP DMC via OData v4 with optional OData query parameters.',
    {
      mdoName: z.string().describe('Name of the Managed Data Object (entity set), e.g. ToolList'),
      filter: z.string().optional().describe('Full OData v4 filter string, e.g., "plant eq \'VIJ_01\' and status eq \'ACTIVE\'"'),
      select: z.string().optional().describe('Comma-separated list of properties to select, e.g., "toolId,status,location"'),
      orderby: z.string().optional().describe('Property sort order, e.g., "toolId desc"'),
      top: z.number().optional().describe('Limit the number of returned records ($top). Defaults to 100.'),
      skip: z.number().optional().describe('Skip the first N records ($skip). Defaults to 0.'),
    },
    async ({ mdoName, filter, select, orderby, top, skip }) => {
      const client = clientFactory.getClient('custom_mdo') as ODataV4Client;

      const topLimit = top !== undefined ? top : 100;
      const skipOffset = skip !== undefined ? skip : 0;

      const queryParams: Record<string, string> = {};
      if (filter) queryParams['$filter'] = filter;
      if (select) queryParams['$select'] = select;
      if (orderby) queryParams['$orderby'] = orderby;
      queryParams['$top'] = topLimit.toString();
      queryParams['$skip'] = skipOffset.toString();

      const path = `/${mdoName}`;

      try {
        const data = await client.get(path, queryParams);
        const paginatedResult = formatPaginatedResult(data, topLimit, skipOffset);
        return {
          content: [{ type: 'text', text: JSON.stringify(paginatedResult, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `OData v4 query failed on MDO ${mdoName}: ${error.message}` }],
        };
      }
    }
  );

  // Generic tool to get exact case-sensitive column/field names for any of the 53 extractor entities
  server.tool(
    'get_extractor_fields',
    'Get the exact case-sensitive column/field names for any of the 53 OData v4 extractor entities (e.g. ORDER, LABOR_SCHEDULE, SFC, PLANT) so you can construct valid query filters.',
    {
      extractorName: z.string().describe('The name of the extractor entity, e.g. ORDER, LABOR_SCHEDULE, SFC, PLANT, WORKCENTER, BOM'),
    },
    async ({ extractorName }) => {
      const metadata = extractorMetadata as Record<string, string[] | undefined>;
      const fields = metadata[extractorName];
      if (!fields) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Extractor "${extractorName}" not found. Available extractors are: ${Object.keys(extractorMetadata).join(', ')}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ extractorName, fields }, null, 2),
          },
        ],
      };
    }
  );

  // Generic tool to query any extractor entity with pagination support
  server.tool(
    'query_dmc_extractor',
    'Query any extractor entity in SAP DMC via OData v4 Extractor. Returns paginated results (defaults to 100 records). REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      extractorName: z.string().describe('The name of the extractor entity (e.g., ORDER, LABOR_SCHEDULE, SFC, PLANT, WORKCENTER, BOM)'),
      filter: z.string().optional().describe('OData filter expression, e.g., "PLANT eq \'VIJ_01\' and LAST_UPDATED_AT ge 2026-05-20T00:00:00Z"'),
      select: z.string().optional().describe('Properties to select (comma-separated), e.g., "ID,PLANT,CATEGORY,USER_ID"'),
      orderby: z.string().optional().describe('Sort property and direction, e.g., "LAST_UPDATED_AT desc"'),
      top: z.number().optional().describe('Limit the number of returned records ($top). Defaults to 100.'),
      skip: z.number().optional().describe('Skip the first N records ($skip). Defaults to 0.'),
      expand: z.string().optional().describe('Expand related navigation properties ($expand)'),
    },
    async ({ extractorName, filter, select, orderby, top, skip, expand }) => {
      const client = clientFactory.getClient('dmci_extractor') as ODataV4Client;

      const topLimit = top !== undefined ? top : 100;
      const skipOffset = skip !== undefined ? skip : 0;

      const queryParams: Record<string, string> = {};
      if (filter) queryParams['$filter'] = filter;
      if (select) queryParams['$select'] = select;
      if (orderby) queryParams['$orderby'] = orderby;
      queryParams['$top'] = topLimit.toString();
      queryParams['$skip'] = skipOffset.toString();
      if (expand) queryParams['$expand'] = expand;

      const path = `/${extractorName}`;

      try {
        const data = await client.get(path, queryParams);
        const paginatedResult = formatPaginatedResult(data, topLimit, skipOffset);
        return {
          content: [{ type: 'text', text: JSON.stringify(paginatedResult, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `DMC Extractor query failed on ${extractorName}: ${error.message}` }],
        };
      }
    }
  );

  // Helper function to build cleaner filter strings
  function buildODataFilter(parts: string[]): string | undefined {
    const validParts = parts.filter(Boolean);
    return validParts.length > 0 ? validParts.join(' and ') : undefined;
  }

  // Helper to execute standardized extractor query
  async function executeExtractorQuery(
    extractorName: string,
    filterParts: string[],
    select?: string,
    orderby?: string,
    top?: number,
    skip?: number
  ) {
    const client = clientFactory.getClient('dmci_extractor') as ODataV4Client;
    const topLimit = top !== undefined ? top : 100;
    const skipOffset = skip !== undefined ? skip : 0;

    const queryParams: Record<string, string> = {};
    const filterStr = buildODataFilter(filterParts);
    if (filterStr) queryParams['$filter'] = filterStr;
    if (select) queryParams['$select'] = select;
    if (orderby) queryParams['$orderby'] = orderby;
    queryParams['$top'] = topLimit.toString();
    queryParams['$skip'] = skipOffset.toString();

    const path = `/${extractorName}`;
    const data = await client.get(path, queryParams);
    return formatPaginatedResult(data, topLimit, skipOffset);
  }

  // --- SPECIALIZED MCP ENDPOINTS/TOOLS ---

  // 1. query_dmc_orders
  server.tool(
    'query_dmc_orders',
    'Specialized tool to retrieve production order master records (ORDER table) with simplified arguments and pagination. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      mfgOrder: z.string().optional().describe('Filter by Manufacturing Order ID, e.g. "120"'),
      status: z.string().optional().describe('Filter by execution status (e.g. ACTIVE, COMPLETED, NEW, etc.)'),
      material: z.string().optional().describe('Filter by product/material name, e.g. "01_SUB_ASSY_COMP"'),
      filter: z.string().optional().describe('Additional OData filter expression to combine (e.g. "CREATED_AT ge 2026-05-20T00:00:00Z")'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, mfgOrder, status, material, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (mfgOrder) filterParts.push(`MFG_ORDER eq '${mfgOrder.replace(/'/g, "''")}'`);
      if (status) filterParts.push(`EXECUTION_STATUS eq '${status.replace(/'/g, "''")}'`);
      if (material) filterParts.push(`MATERIAL eq '${material.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'ORDER',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query orders: ${err.message}` }] };
      }
    }
  );

  // 2. query_dmc_labor_schedules
  server.tool(
    'query_dmc_labor_schedules',
    'Specialized tool to query labor schedules (LABOR_SCHEDULE table) for workforce planning, shifts, and supervisor tracking. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      userId: z.string().optional().describe('Filter by user ID, e.g. "10005"'),
      userShift: z.string().optional().describe('Filter by user shift code, e.g. "CUST_NIGHT"'),
      workcenter: z.string().optional().describe('Filter by workcenter name, e.g. "03_WC"'),
      filter: z.string().optional().describe('Additional OData filter expression to combine (e.g. "START_DATE ge \'2026-05-20\'")'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, userId, userShift, workcenter, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (userId) filterParts.push(`USER_ID eq '${userId.replace(/'/g, "''")}'`);
      if (userShift) filterParts.push(`USER_SHIFT eq '${userShift.replace(/'/g, "''")}'`);
      if (workcenter) filterParts.push(`WORKCENTER eq '${workcenter.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'LABOR_SCHEDULE',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query labor schedules: ${err.message}` }] };
      }
    }
  );

  // 3. query_dmc_sfcs
  server.tool(
    'query_dmc_sfcs',
    'Specialized tool to query Shop Floor Control records (SFC table) representing individual production lots/units. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      sfc: z.string().optional().describe('Filter by SFC ID/number, e.g. "SFC12345"'),
      material: z.string().optional().describe('Filter by material name'),
      status: z.string().optional().describe('Filter by SFC status (e.g. IN_QUEUE, DONE, ACTIVE)'),
      filter: z.string().optional().describe('Additional OData filter expression to combine (e.g. "DONE_AT ge 2026-05-20T00:00:00Z")'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, sfc, material, status, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (sfc) filterParts.push(`SFC eq '${sfc.replace(/'/g, "''")}'`);
      if (material) filterParts.push(`MATERIAL eq '${material.replace(/'/g, "''")}'`);
      if (status) filterParts.push(`STATUS eq '${status.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'SFC',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query SFC records: ${err.message}` }] };
      }
    }
  );

  // 4. query_dmc_workcenters
  server.tool(
    'query_dmc_workcenters',
    'Specialized tool to query manufacturing workcenters (WORKCENTER table) representing groups of resources/machines. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      workcenter: z.string().optional().describe('Filter by workcenter name, e.g. "05_WC"'),
      category: z.string().optional().describe('Filter by workcenter category'),
      status: z.string().optional().describe('Filter by status (e.g. ENABLED, DISABLED)'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, workcenter, category, status, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (workcenter) filterParts.push(`WORKCENTER eq '${workcenter.replace(/'/g, "''")}'`);
      if (category) filterParts.push(`CATEGORY eq '${category.replace(/'/g, "''")}'`);
      if (status) filterParts.push(`STATUS eq '${status.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'WORKCENTER',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query workcenters: ${err.message}` }] };
      }
    }
  );

  // 5. query_dmc_resources
  server.tool(
    'query_dmc_resources',
    'Specialized tool to query individual production resources/equipment (RESOURCE table). REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      resource: z.string().optional().describe('Filter by resource ID/name, e.g. "MACH-001"'),
      status: z.string().optional().describe('Filter by resource status (e.g. UP, DOWN, STANDBY)'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, resource, status, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (resource) filterParts.push(`RESOURCE eq '${resource.replace(/'/g, "''")}'`);
      if (status) filterParts.push(`STATUS eq '${status.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'RESOURCE',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query resources: ${err.message}` }] };
      }
    }
  );

  // 6. query_dmc_materials
  server.tool(
    'query_dmc_materials',
    'Specialized tool to query material master definitions (MATERIAL table) for products, assemblies, and components. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      material: z.string().optional().describe('Filter by material name/number, e.g. "01_SUB_ASSY_COMP"'),
      status: z.string().optional().describe('Filter by status (e.g. CURRENT, DELETED)'),
      type: z.string().optional().describe('Filter by material type, e.g. "MANUFACTURED", "PURCHASED"'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, material, status, type, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (material) filterParts.push(`MATERIAL eq '${material.replace(/'/g, "''")}'`);
      if (status) filterParts.push(`STATUS eq '${status.replace(/'/g, "''")}'`);
      if (type) filterParts.push(`TYPE eq '${type.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'MATERIAL',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query materials: ${err.message}` }] };
      }
    }
  );

  // 7. query_dmc_boms
  server.tool(
    'query_dmc_boms',
    'Specialized tool to query Bill of Materials components (BOM_COMPONENT table) linking parents to assembly materials. REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      bom: z.string().optional().describe('Filter by parent BOM name'),
      material: z.string().optional().describe('Filter by component material number'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, bom, material, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (bom) filterParts.push(`BOM eq '${bom.replace(/'/g, "''")}'`);
      if (material) filterParts.push(`MATERIAL eq '${material.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'BOM_COMPONENT',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query BOM components: ${err.message}` }] };
      }
    }
  );

  // 8. query_dmc_downtimes
  server.tool(
    'query_dmc_downtimes',
    'Specialized tool to query equipment/resource downtime events (DOWNTIME table) for OEE and utilization tracking. REQUIRED WORKFLOW: After fetching all records (paginating if needed) and analyzing/forecasting, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      resource: z.string().optional().describe('Filter by resource name/ID'),
      reasonCode: z.string().optional().describe('Filter by reason code identifier (REASON_CODE_ID)'),
      filter: z.string().optional().describe('Additional OData filter expression to combine (e.g. "DOWNTIME_START_DATE_TIME ge 2026-05-20T00:00:00Z")'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, resource, reasonCode, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (resource) filterParts.push(`RESOURCE eq '${resource.replace(/'/g, "''")}'`);
      if (reasonCode) filterParts.push(`REASON_CODE_ID eq '${reasonCode.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'DOWNTIME',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query downtimes: ${err.message}` }] };
      }
    }
  );

  // 9. query_dmc_order_schedules
  server.tool(
    'query_dmc_order_schedules',
    'Specialized tool to query production schedules and operational execution logs (ORDER_SCHEDULE table). REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      mfgOrder: z.string().optional().describe('Filter by Manufacturing Order ID, e.g. "120"'),
      resource: z.string().optional().describe('Filter by executing resource'),
      workcenter: z.string().optional().describe('Filter by workcenter name'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "LAST_UPDATED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, mfgOrder, resource, workcenter, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (mfgOrder) filterParts.push(`MFG_ORDER eq '${mfgOrder.replace(/'/g, "''")}'`);
      if (resource) filterParts.push(`RESOURCE eq '${resource.replace(/'/g, "''")}'`);
      if (workcenter) filterParts.push(`WORKCENTER eq '${workcenter.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'ORDER_SCHEDULE',
          filterParts,
          select,
          orderby || 'LAST_UPDATED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query order schedules: ${err.message}` }] };
      }
    }
  );

  // 10. query_dmc_sfc_production_events
  server.tool(
    'query_dmc_sfc_production_events',
    'Specialized tool to query individual step executions and yield/scrap logs for SFCs (SFC_PRODUCTION_EVENTS table). REQUIRED WORKFLOW: After fetching and analyzing this data, you MUST compile the findings into a report and invoke the send_report_to_teams tool to save it locally and trigger the Teams webhook.',
    {
      plant: z.string().optional().describe('Plant code. Allowed values: "VIJ_01", "M205". Defaults to "VIJ_01".'),
      sfc: z.string().optional().describe('Filter by SFC ID, e.g. "SFC12345"'),
      eventType: z.string().optional().describe('Filter by event type, e.g. "START", "COMPLETE", "SCRAP"'),
      userId: z.string().optional().describe('Filter by operator User ID'),
      filter: z.string().optional().describe('Additional OData filter expression to combine'),
      select: z.string().optional().describe('Comma-separated properties to return'),
      orderby: z.string().optional().describe('Sorting criteria. Defaults to "EVENT_OCCURRED_AT desc".'),
      top: z.number().optional().describe('Number of records to fetch. Defaults to 100.'),
      skip: z.number().optional().describe('Number of records to skip. Defaults to 0.'),
    },
    async ({ plant, sfc, eventType, userId, filter, select, orderby, top, skip }) => {
      const activePlant = plant || env.dmc.plant || 'VIJ_01';
      const filterParts = [`PLANT eq '${activePlant.replace(/'/g, "''")}'`];
      if (sfc) filterParts.push(`SFC eq '${sfc.replace(/'/g, "''")}'`);
      if (eventType) filterParts.push(`EVENT_TYPE eq '${eventType.replace(/'/g, "''")}'`);
      if (userId) filterParts.push(`USER_ID eq '${userId.replace(/'/g, "''")}'`);
      if (filter) filterParts.push(filter);

      try {
        const result = await executeExtractorQuery(
          'SFC_PRODUCTION_EVENTS',
          filterParts,
          select,
          orderby || 'EVENT_OCCURRED_AT desc',
          top,
          skip
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Failed to query SFC production events: ${err.message}` }] };
      }
    }
  );
}
