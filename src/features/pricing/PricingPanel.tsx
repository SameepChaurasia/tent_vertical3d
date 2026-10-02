import { useEffect, useState, useRef, useCallback } from 'react';
import type { PriceQuote, QuoteRequest } from '../../domain/schemas';
import { formatCentsAsDisplay } from '../../domain/pricing/pricing-engine';
import {
  useConfiguratorStore,
  selectQuantity,
  selectConfiguration,
} from '../configurator/configurator.store';
import type { PricingService } from '../../services/interfaces';

interface PricingPanelProps {
  pricingService: PricingService;
  onQuoteReady?: (quote: PriceQuote) => void;
}

/**
 * Price panel — displays the live price breakdown.
 *
 * Uses debounced requests to the pricing service with cancellation
 * of stale quotes. Shows optimistic UI (last known price) while loading.
 */
export function PricingPanel({ pricingService, onQuoteReady }: PricingPanelProps) {
  const configuration = useConfiguratorStore(selectConfiguration);
  const quantity = useConfiguratorStore(selectQuantity);

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!configuration) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    /* Count custom layers for surcharge calculation */
    let customImageCount = 0;
    let customTextCount = 0;
    for (const section of Object.values(configuration.sections)) {
      for (const layer of section.layers) {
        if (layer.kind === 'image') customImageCount++;
        if (layer.kind === 'text') customTextCount++;
      }
    }

    const request: QuoteRequest = {
      productId: configuration.productId,
      sizeId: configuration.sizeId,
      options: configuration.options,
      customImageCount,
      customTextCount,
      quantity,
    };

    try {
      const result = await pricingService.getQuote(request);

      /* Discard stale responses */
      if (requestId !== requestIdRef.current) return;

      setQuote(result);
      setIsLoading(false);
      onQuoteReady?.(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to get price quote');
      setIsLoading(false);
    }
  }, [configuration, quantity, pricingService, onQuoteReady]);

  /* Debounced price fetch on configuration changes */
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(fetchQuote, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchQuote]);

  return (
    <div className="pricing-panel">
      <h3 className="pricing-panel-title">Price Breakdown</h3>

      {error && (
        <div className="pricing-error" role="alert">
          <p>{error}</p>
          <button onClick={fetchQuote} className="pricing-retry-button">
            Retry
          </button>
        </div>
      )}

      {quote && (
        <div className={`pricing-breakdown ${isLoading ? 'pricing-loading' : ''}`}>
          <ul className="pricing-line-items">
            {quote.lineItems.map((item, index) => (
              <li key={`${item.code}-${index}`} className="pricing-line-item">
                <span className="pricing-item-label">{item.label}</span>
                <span className={`pricing-item-amount ${item.amountCents < 0 ? 'pricing-discount' : ''}`}>
                  {item.amountCents < 0 ? '−' : ''}
                  {formatCentsAsDisplay(Math.abs(item.amountCents), quote.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="pricing-total">
            <span className="pricing-total-label">Total</span>
            <span className="pricing-total-amount">
              {formatCentsAsDisplay(quote.totalCents, quote.currency)}
            </span>
          </div>
        </div>
      )}

      {isLoading && !quote && (
        <div className="pricing-skeleton">
          <div className="pricing-skeleton-line" />
          <div className="pricing-skeleton-line" />
          <div className="pricing-skeleton-line pricing-skeleton-total" />
        </div>
      )}
    </div>
  );
}
