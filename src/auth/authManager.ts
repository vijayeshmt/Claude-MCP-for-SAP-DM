import { env } from '../config.js';
import { AuthHeaders, TokenCache } from './types.js';

class AuthManager {
  private tokenCache: Record<string, TokenCache> = {};

  /**
   * Returns authorization headers for the specified profile.
   */
  async getHeaders(profile: string): Promise<AuthHeaders> {
    switch (profile) {
      case 'default_btp':
        return this.getBtpHeaders();
      case 'mock_auth':
        return { Authorization: 'Bearer mock-token-12345' };
      default:
        console.warn(`Unknown auth profile: ${profile}. Returning empty auth headers.`);
        return {};
    }
  }

  /**
   * Fetches/retrieves cached OAuth token for default BTP profile.
   */
  private async getBtpHeaders(): Promise<AuthHeaders> {
    const { tokenUrl, clientId, clientSecret } = env.dmc;

    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error(
        'Missing BTP credentials. Please check DMC_TOKEN_URL, DMC_CLIENT_ID, and DMC_CLIENT_SECRET in your .env file.'
      );
    }

    const cacheKey = `${tokenUrl}|${clientId}`;
    const cached = this.tokenCache[cacheKey];

    if (cached && Date.now() < cached.expiresAt) {
      return { Authorization: `Bearer ${cached.value}` };
    }

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`BTP Auth failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      // Cache token, expire 60 seconds early to prevent edge cases
      const expiresAt = Date.now() + data.expires_in * 1000 - 60000;
      this.tokenCache[cacheKey] = {
        value: data.access_token,
        expiresAt,
      };

      return { Authorization: `Bearer ${data.access_token}` };
    } catch (error) {
      console.error('Error fetching BTP OAuth token:', error);
      throw error;
    }
  }
}

export const authManager = new AuthManager();
