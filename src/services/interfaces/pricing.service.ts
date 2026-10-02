import type { PriceQuote, QuoteRequest } from '../../domain/schemas';

/**
 * PricingService — abstraction over the pricing API.
 *
 * Mock implementation computes prices locally; production implementation
 * calls the serverless pricing endpoint. Both return the same signed quote.
 */
export interface PricingService {
  /** Request a price quote for the given configuration summary */
  getQuote(request: QuoteRequest): Promise<PriceQuote>;
}
