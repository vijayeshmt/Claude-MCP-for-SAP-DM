import { clientFactory } from '../clients/clientFactory.js';
import { ODataV4Client } from '../clients/odataV4Client.js';

async function runRealTest() {
  console.log('--- STARTING REAL SAP DMC API TESTING ---');
  console.log('Testing connection to real BTP extractor endpoint...');

  try {
    const extractorClient = clientFactory.getClient('dmci_extractor') as ODataV4Client;

    // Fetch the list of available extractors from the root endpoint
    console.log('\n[Step 1] Fetching root extractors list...');
    const rootData = await extractorClient.get('/');
    console.log('Available extractors count:', rootData ? rootData.length : 0);
    if (rootData && rootData.length > 0) {
      console.log('First few extractors:', rootData.slice(0, 5));
    }

    // Query LABOR_SCHEDULE with a small top limit
    console.log('\n[Step 2] Fetching LABOR_SCHEDULE (limiting to top 2 records)...');
    const laborData = await extractorClient.get('/LABOR_SCHEDULE', { $top: '2' });
    console.log('LABOR_SCHEDULE count:', laborData ? laborData.length : 0);

    // Query LABOR_SCHEDULE with a filter containing spaces (tests percent-encoding spaces as %20 instead of +)
    console.log('\n[Step 3] Fetching LABOR_SCHEDULE with filter: PLANT eq \'VIJ_01\'...');
    const laborDataWithFilter = await extractorClient.get('/LABOR_SCHEDULE', {
      $filter: "PLANT eq 'VIJ_01'",
      $top: '2',
    });
    console.log('Filtered LABOR_SCHEDULE response:');
    console.log(JSON.stringify(laborDataWithFilter, null, 2));

    // Query ORDER with sorting and top limit (most recent first)
    console.log('\n[Step 4] Fetching most recent ORDER sorted by LAST_UPDATED_AT...');
    const orderData = await extractorClient.get('/ORDER', {
      $filter: "PLANT eq 'VIJ_01'",
      $orderby: "LAST_UPDATED_AT desc",
      $top: '1',
    });
    console.log('Most recent ORDER response:');
    console.log(JSON.stringify(orderData, null, 2));

    console.log('\n--- REAL API TEST COMPLETED SUCCESSFULLY ---');
  } catch (error: any) {
    console.error('\n!!! REAL API TEST FAILED !!!');
    console.error(error.message || error);
    process.exit(1);
  }
}

runRealTest();
