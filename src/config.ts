import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve .env path relative to compiled dist/ location (one folder up in root)
dotenv.config({ path: join(__dirname, '..', '.env') });

export interface EndpointConfig {
  baseUrl: string;
  protocol: 'REST' | 'ODATA_V2' | 'ODATA_V4';
  authProfile: string;
}

interface RawEndpointConfig {
  path: string;
  protocol: 'REST' | 'ODATA_V2' | 'ODATA_V4';
  authProfile: string;
}

export interface ApiConfig {
  endpoints: Record<string, EndpointConfig>;
}

// Load env configuration
export const env = {
  dmc: {
    endpoint: process.env.DMC_API_ENDPOINT || 'https://api.eu20.dmc.cloud.sap',
    tokenUrl: process.env.DMC_TOKEN_URL || '',
    clientId: process.env.DMC_CLIENT_ID || '',
    clientSecret: process.env.DMC_CLIENT_SECRET || '',
    plant: process.env.DMC_PLANT || '',
  },
};

// Load api_config.json relative to the module file location
const configPath = join(__dirname, '..', 'api_config.json');

let apiConfig: ApiConfig = { endpoints: {} };

try {
  const fileContent = readFileSync(configPath, 'utf8');
  const rawApiConfig = JSON.parse(fileContent) as {
    endpoints: Record<string, RawEndpointConfig>;
  };
  
  // Dynamically resolve full baseUrl using DMC_API_ENDPOINT from .env
  const host = env.dmc.endpoint.endsWith('/') 
    ? env.dmc.endpoint.slice(0, -1) 
    : env.dmc.endpoint;

  const resolvedEndpoints: Record<string, EndpointConfig> = {};
  for (const [key, rawConfig] of Object.entries(rawApiConfig.endpoints)) {
    const cleanPath = rawConfig.path.startsWith('/') 
      ? rawConfig.path 
      : `/${rawConfig.path}`;
    
    resolvedEndpoints[key] = {
      baseUrl: `${host}${cleanPath}`,
      protocol: rawConfig.protocol,
      authProfile: rawConfig.authProfile,
    };
  }
  
  apiConfig.endpoints = resolvedEndpoints;
} catch (error) {
  console.error(`Failed to load/parse api_config.json:`, error);
}

export { apiConfig };
