import type { Configuration, PriceQuote } from '../../domain/schemas';

/**
 * Payload sent to Shopify's /cart/add.js API.
 * Properties prefixed with underscore are hidden from the customer at checkout.
 */
export interface ShopifyCartPayload {
  id: string;
  quantity: number;
  properties: Record<string, string>;
}

/**
 * CartService — abstraction over the Shopify cart API.
 *
 * MockShopifyCartService simulates the cart drawer for the demo.
 * ShopifyAjaxCartService builds the real /cart/add.js payload.
 * When running in an iframe, the cart call is delegated to the parent via postMessage.
 */
export interface CartService {
  /** Build the cart payload from configuration and quote */
  buildCartPayload(
    configuration: Configuration,
    quote: PriceQuote,
    variantId: string,
  ): ShopifyCartPayload;

  /** Add the configured product to the cart */
  addToCart(payload: ShopifyCartPayload): Promise<{ success: boolean; error?: string }>;
}
