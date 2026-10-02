import type { CartService, ShopifyCartPayload } from '../interfaces';
import type { Configuration, PriceQuote } from '../../domain/schemas';
import { formatCentsAsDisplay } from '../../domain/pricing/pricing-engine';

/**
 * Mock Shopify cart service for the demo.
 *
 * Builds a realistic /cart/add.js payload structure, then simulates
 * the cart response. A JSON inspector in the UI shows exactly what
 * would be sent to Shopify in production.
 *
 * PRODUCTION NOTES:
 * - ShopifyAjaxCartService would POST to /cart/add.js with the same payload.
 * - For arbitrary customization fees beyond variant pricing, Shopify requires
 *   either a Cart Transform function (Shopify Functions) or a draft order
 *   via the Admin API. Variant mapping alone cannot handle dynamic surcharges.
 * - When running inside an iframe on a Shopify store, the cart call must be
 *   delegated to the parent page via postMessage, because cross-origin iframes
 *   cannot access the store's cart cookies.
 */
export class MockCartService implements CartService {
  private cartItems: ShopifyCartPayload[] = [];

  buildCartPayload(
    configuration: Configuration,
    quote: PriceQuote,
    variantId: string,
  ): ShopifyCartPayload {
    const optionSummary = Object.entries(configuration.options)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return {
      id: variantId,
      quantity: 1,
      properties: {
        /* Visible to customer at checkout */
        'Configuration': optionSummary,
        'Price': formatCentsAsDisplay(quote.totalCents, quote.currency),

        /* Hidden from customer (underscore prefix convention) */
        '_configuration_id': configuration.configurationId,
        '_quote_id': quote.quoteId,
        '_quote_signature': quote.signature,
        '_schema_version': String(configuration.schemaVersion),
        '_preview_url': `/api/configurations/${configuration.configurationId}/preview`,
        '_production_pdf_url': `/api/configurations/${configuration.configurationId}/pdf`,
      },
    };
  }

  async addToCart(
    payload: ShopifyCartPayload,
  ): Promise<{ success: boolean; error?: string }> {
    /* Simulate network latency */
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.cartItems.push(payload);

    return { success: true };
  }

  /** For the demo UI: get current cart items */
  getCartItems(): ShopifyCartPayload[] {
    return [...this.cartItems];
  }

  /** For the demo UI: clear the cart */
  clearCart(): void {
    this.cartItems = [];
  }
}
