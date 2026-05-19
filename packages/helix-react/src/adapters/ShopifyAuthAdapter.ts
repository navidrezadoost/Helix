export interface ShopifyAuthAdapter {
  fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export function useShopifyAuth(): ShopifyAuthAdapter | null {
  return null;
}