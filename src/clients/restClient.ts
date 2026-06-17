import { BaseClient } from './baseClient.js';

export class RestClient extends BaseClient {
  async get(path: string, params?: Record<string, string>): Promise<any> {
    let queryPath = path;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, val);
        }
      });
      // Replace '+' space encoding with '%20' for consistent space encoding
      const queryString = searchParams.toString().replace(/\+/g, '%20');
      if (queryString) {
        queryPath += (path.includes('?') ? '&' : '?') + queryString;
      }
    }

    const response = await this.request(queryPath, { method: 'GET' });
    return response.json();
  }

  async post(path: string, body: any): Promise<any> {
    const response = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
