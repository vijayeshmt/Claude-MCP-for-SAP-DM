import { clientFactory } from '../clients/clientFactory.js';
import { ODataV4Client } from '../clients/odataV4Client.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function runMetadataExtraction() {
  console.log('--- STARTING DYNAMIC EXTRACTOR METADATA DISCOVERY ---');
  const client = clientFactory.getClient('dmci_extractor') as ODataV4Client;

  try {
    // 1. Fetch all entity sets from root
    console.log('Fetching list of all available entities...');
    const rootEntities = await client.get('/') as { name: string; url: string }[];
    console.log(`Found ${rootEntities.length} entities in the root response.`);

    const schemaMap: Record<string, string[]> = {};
    const failedEntities: string[] = [];

    // 2. Loop over each entity and query the schema
    for (let i = 0; i < rootEntities.length; i++) {
      const entityName = rootEntities[i].name;
      console.log(`[${i + 1}/${rootEntities.length}] Analyzing entity: ${entityName}...`);

      let data: any = null;
      
      // Try querying with PLANT filter first (most extractors have PLANT)
      try {
        data = await client.get(`/${entityName}`, {
          $filter: "PLANT eq 'VIJ_01'",
          $top: '1'
        });
      } catch (err: any) {
        // If PLANT filter fails (e.g. field doesn't exist), fall back to top 1 without filter
        try {
          data = await client.get(`/${entityName}`, {
            $top: '1'
          });
        } catch (fallbackErr: any) {
          console.error(`  X Failed to query ${entityName}: ${fallbackErr.message}`);
          failedEntities.push(entityName);
          continue;
        }
      }

      // Extract keys from first item
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        const fields = Object.keys(firstItem);
        schemaMap[entityName] = fields;
        console.log(`  ✓ Discovered ${fields.length} columns.`);
      } else {
        // Empty response, try to fetch $metadata or store empty
        schemaMap[entityName] = [];
        console.log(`  ⚠ Response was empty (no records found to infer columns).`);
      }
    }

    // 3. Write metadata file
    const outputPath = join(process.cwd(), 'src', 'tools', 'extractor_metadata.json');
    writeFileSync(outputPath, JSON.stringify(schemaMap, null, 2), 'utf8');
    
    console.log('\n--- METADATA DISCOVERY SUMMARY ---');
    console.log(`Successfully mapped: ${Object.keys(schemaMap).length} entities.`);
    console.log(`Failed to query: ${failedEntities.length} entities.`);
    console.log(`Metadata saved to: ${outputPath}`);
  } catch (error: any) {
    console.error('Extraction failed:', error);
    process.exit(1);
  }
}

runMetadataExtraction();
