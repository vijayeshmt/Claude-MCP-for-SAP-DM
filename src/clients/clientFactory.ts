import { apiConfig } from '../config.js';
import { RestClient } from './restClient.js';
import { ODataV2Client } from './odataV2Client.js';
import { ODataV4Client } from './odataV4Client.js';
import { BaseClient } from './baseClient.js';

class ClientFactory {
  private clients: Record<string, BaseClient> = {};

  /**
   * Retrieves or instantiates the specialized client for the given endpoint configuration.
   */
  getClient(endpointKey: string): BaseClient {
    // Return cached client if available
    if (this.clients[endpointKey]) {
      return this.clients[endpointKey];
    }

    const config = apiConfig.endpoints[endpointKey];
    if (!config) {
      throw new Error(`Endpoint key "${endpointKey}" not found in api_config.json`);
    }

    let client: BaseClient;

    switch (config.protocol) {
      case 'REST':
        client = new RestClient(config);
        break;
      case 'ODATA_V2':
        client = new ODataV2Client(config);
        break;
      case 'ODATA_V4':
        client = new ODataV4Client(config);
        break;
      default:
        throw new Error(`Unsupported API protocol: ${(config as any).protocol}`);
    }

    this.clients[endpointKey] = client;
    return client;
  }
}

export const clientFactory = new ClientFactory();
export { BaseClient, RestClient, ODataV2Client, ODataV4Client };
