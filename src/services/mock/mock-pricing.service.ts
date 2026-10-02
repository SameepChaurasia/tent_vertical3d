import { v4 as uuidv4 } from 'uuid';
import type { PricingService } from '../interfaces';
import type { PriceQuote, QuoteRequest } from '../../domain/schemas';
import { computeQuoteLineItems } from '../../domain/pricing/pricing-engine';
import { CANOPY_TENT_PRICING } from '../../domain/pricing/canopy-tent.pricing';

/**
 * Mock pricing service that computes quotes locally using the domain pricing engine.
 *
 * In production, this would be replaced by HttpPricingService calling the
 * Vercel serverless function at /api/pricing/quote. The serverless function
 * uses the same computeQuoteLineItems engine but also signs the quote with HMAC.
 */
export class MockPricingService implements PricingService {
  async getQuote(request: QuoteRequest): Promise<PriceQuote> {
    /* Simulate network latency for realistic UX testing */
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    const { lineItems, totalCents } = computeQuoteLineItems(
      request,
      CANOPY_TENT_PRICING,
    );

    const quoteId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    /*
     * In production the signature would be HMAC-SHA256(quoteId + totalCents, secret).
     * For the mock we use a placeholder that the cart service can still verify structurally.
     */
    const signature = `mock-sig-${quoteId.slice(0, 8)}`;

    return {
      currency: 'USD',
      lineItems,
      subtotalCents: totalCents,
      totalCents,
      quoteId,
      signature,
      expiresAt,
      quantity: request.quantity,
    };
  }
}
