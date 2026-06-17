import { BaseClient } from './baseClient.js';

export class ODataV2Client extends BaseClient {
  /**
   * Helper to build a standard OData $filter string from a key-value object.
   * Example: { Plant: 'P001', Status: 'RELEASED' } -> "Plant eq 'P001' and Status eq 'RELEASED'"
   */
  buildFilter(filters: Record<string, string | number | boolean | undefined | null>): string {
    const parts: string[] = [];
    Object.entries(filters).forEach(([key, val]) => {
      if (val === undefined || val === null) return;
      if (typeof val === 'string') {
        // Simple escape for single quotes
        const escaped = val.replace(/'/g, "''");
        parts.push(`${key} eq '${escaped}'`);
      } else {
        parts.push(`${key} eq ${val}`);
      }
    });
    return parts.join(' and ');
  }

  async get(path: string, params?: Record<string, string>): Promise<any> {
    let queryPath = path;
    const finalParams = {
      $format: 'json',
      ...(params || {}),
    };

    const searchParams = new URLSearchParams();
    Object.entries(finalParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, val);
      }
    });

    // Replace '+' space encoding with '%20' for strict SAP URL parsing
    const queryString = searchParams.toString().replace(/\+/g, '%20');
    if (queryString) {
      queryPath += (path.includes('?') ? '&' : '?') + queryString;
    }

    const response = await this.request(queryPath, { method: 'GET' });
    const data = await response.json();

    // Unwrap OData v2 payload structure: { d: { results: [...] } } or { d: { ... } }
    if (data && typeof data === 'object' && 'd' in data) {
      const dVal = data.d;
      if (dVal && typeof dVal === 'object' && 'results' in dVal) {
        return dVal.results;
      }
      return dVal;
    }

    return data;
  }

  async post(path: string, body: any): Promise<any> {
    // Some OData v2 POST endpoints need specific headers like x-csrf-token
    // In read-only scenarios this is simple; for write actions, CSRF token fetching
    // is needed. Let's make this client CSRF-aware for POST requests:
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Note: If full CSRF handling is required, we can first make a GET to fetch 'X-CSRF-Token: Fetch'
    // and extract the token. Let's implement that logic dynamically:
    let csrfToken = 'Fetch';
    try {
      console.error(`[OData V2 CSRF] Fetching CSRF token from base URL`);
      const getResponse = await this.request('/', {
        method: 'GET',
        headers: { 'X-CSRF-Token': 'Fetch' },
      });
      const token = getResponse.headers.get('x-csrf-token');
      if (token) {
        csrfToken = token;
        console.error(`[OData V2 CSRF] Token successfully fetched`);
      }
    } catch (e) {
      console.error(`[OData V2 CSRF] Failed to fetch CSRF token (may not be required for mock/some setups):`, e);
    }

    if (csrfToken && csrfToken !== 'Fetch') {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await this.request(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data && typeof data === 'object' && 'd' in data) {
      return data.d;
    }
    return data;
  }
}
