import { EndpointConfig } from '../config.js';
import { authManager } from '../auth/authManager.js';

export abstract class BaseClient {
  protected config: EndpointConfig;

  constructor(config: EndpointConfig) {
    this.config = config;
  }

  /**
   * Helper to perform HTTP request, adding authorization headers automatically.
   */
  protected async request(path: string, options: RequestInit = {}): Promise<Response> {
    const authHeaders = await authManager.getHeaders(this.config.authProfile);
    
    // Construct final URL
    // Handle leading/trailing slashes nicely
    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${baseUrl}${cleanPath}`;

    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    } as Record<string, string>;

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    console.error(`[API Request] [${this.config.protocol}] ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        let errorDetails = '';
        try {
          errorDetails = await response.text();
        } catch {
          // ignore
        }
        throw new Error(
          `HTTP error! status: ${response.status} ${response.statusText}. Details: ${errorDetails}`
        );
      }
      return response;
    } catch (error) {
      console.error(`[API Request Error] ${options.method || 'GET'} ${url}:`, error);
      throw error;
    }
  }

  /**
   * Send GET request
   */
  abstract get(path: string, params?: Record<string, string>): Promise<any>;

  /**
   * Send POST request
   */
  abstract post(path: string, body: any): Promise<any>;
}
