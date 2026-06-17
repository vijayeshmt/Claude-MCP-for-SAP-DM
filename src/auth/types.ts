export interface AuthHeaders {
  Authorization?: string;
  [key: string]: string | undefined;
}

export interface TokenCache {
  value: string;
  expiresAt: number;
}
