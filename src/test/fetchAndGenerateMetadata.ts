import { clientFactory } from '../clients/clientFactory.js';
import { ODataV4Client } from '../clients/odataV4Client.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

class PublicODataClient extends ODataV4Client {
  public async fetchRaw(path: string) {
    const res = await this.request(path, { method: 'GET' });
    return res.text();
  }
}

async function main() {
  console.log('--- STARTING DYNAMIC SCHEMAS DISCOVERY & SAMPLE DATA QUERY ---');
  const client = new PublicODataClient(clientFactory.getClient('dmci_extractor')['config']);

  try {
    // 1. Fetch metadata XML
    console.log('Fetching /$metadata XML...');
    const xml = await client.fetchRaw('/$metadata');
    console.log(`Metadata fetched successfully. Length: ${xml.length} bytes.`);

    // 2. Parse XML to extract EntityTypes and their Properties
    console.log('Parsing EntityTypes and properties...');
    const entityTypeRegex = /<EntityType\s+Name="([^"]+)"([\s\S]*?)<\/EntityType>/g;
    const propertyRegex = /<Property\s+Name="([^"]+)"/g;

    const schemaMap: Record<string, string[]> = {};
    let match;
    while ((match = entityTypeRegex.exec(xml)) !== null) {
      const entityName = match[1];
      const entityContent = match[2];
      const properties: string[] = [];
      let propMatch;
      while ((propMatch = propertyRegex.exec(entityContent)) !== null) {
        properties.push(propMatch[1]);
      }
      schemaMap[entityName] = properties;
    }

    const entities = Object.keys(schemaMap).sort();
    console.log(`Found ${entities.length} distinct entity types in metadata.`);

    // 3. Query top 10 records for plant VIJ_01 for each entity
    const queryReport: Record<string, {
      status: 'success' | 'error';
      recordCount: number;
      error: string | null;
      data: any[];
    }> = {};

    for (let i = 0; i < entities.length; i++) {
      const entityName = entities[i];
      const properties = schemaMap[entityName];
      const hasPlant = properties.includes('PLANT');
      
      console.log(`[${i + 1}/${entities.length}] Querying entity: ${entityName} (has PLANT: ${hasPlant})...`);

      const queryParams: Record<string, string> = { $top: '10' };
      if (hasPlant) {
        queryParams['$filter'] = "PLANT eq 'VIJ_01'";
      }

      try {
        const data = await client.get(`/${entityName}`, queryParams);
        const recordCount = Array.isArray(data) ? data.length : (data ? 1 : 0);
        queryReport[entityName] = {
          status: 'success',
          recordCount,
          error: null,
          data: Array.isArray(data) ? data : [data]
        };
        console.log(`  ✓ Success: fetched ${recordCount} records.`);
      } catch (err: any) {
        console.error(`  X Error querying ${entityName}: ${err.message}`);
        queryReport[entityName] = {
          status: 'error',
          recordCount: 0,
          error: err.message,
          data: []
        };
      }
    }

    // 4. Save the sample data / report to plant_vij_01_top_10.json
    const sampleDataPath = join(process.cwd(), 'src', 'test', 'plant_vij_01_top_10.json');
    writeFileSync(sampleDataPath, JSON.stringify(queryReport, null, 2), 'utf8');
    console.log(`\nSample data report saved to: ${sampleDataPath}`);

    // 5. Generate and overwrite src/tools/extractor_metadata.ts
    const metadataTsPath = join(process.cwd(), 'src', 'tools', 'extractor_metadata.ts');
    
    let tsContent = `// Auto-generated from live OData v4 $metadata schema\n`;
    tsContent += `export const extractorMetadata: Record<string, string[]> = {\n`;
    for (const entityName of entities) {
      tsContent += `  "${entityName}": [\n`;
      const props = schemaMap[entityName];
      for (let j = 0; j < props.length; j++) {
        const comma = j === props.length - 1 ? '' : ',';
        tsContent += `    "${props[j]}"${comma}\n`;
      }
      tsContent += `  ],\n`;
    }
    // Remove last comma nicely if needed, or leave it (valid JS/TS)
    tsContent += `};\n`;

    writeFileSync(metadataTsPath, tsContent, 'utf8');
    console.log(`Updated schemas saved to: ${metadataTsPath}`);
    console.log('\n--- METADATA SCHEMAS UPDATE COMPLETED ---');

  } catch (error: any) {
    console.error('Fatal error during schema and query execution:', error);
    process.exit(1);
  }
}

main();
