import { BaseClient } from './baseClient.js';

export class ODataV4Client extends BaseClient {
  /**
   * Helper to build a standard OData $filter string from a key-value object.
   */
  buildFilter(filters: Record<string, string | number | boolean | undefined | null>): string {
    const parts: string[] = [];
    Object.entries(filters).forEach(([key, val]) => {
      if (val === undefined || val === null) return;
      if (typeof val === 'string') {
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
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, val);
        }
      });
      // Replace '+' space encoding with '%20' for strict SAP URL parsing
      const queryString = searchParams.toString().replace(/\+/g, '%20');
      if (queryString) {
        queryPath += (path.includes('?') ? '&' : '?') + queryString;
      }
    }

    const response = await this.request(queryPath, { method: 'GET' });
    const data = await response.json();

    // Unwrap OData v4 payload structure: { value: [...] }
    if (data && typeof data === 'object' && 'value' in data) {
      return data.value;
    }

    return data;
  }

  async post(path: string, body: any): Promise<any> {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
