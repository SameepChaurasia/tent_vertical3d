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
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
          <span>💳</span>
          <span>Price Breakdown</span>
        </h3>
        {isLoading && (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Recalculating…
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center justify-between" role="alert">
          <p>{error}</p>
          <button
            onClick={fetchQuote}
            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {quote && (
        <div className={`flex flex-col gap-2 transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
          <ul className="flex flex-col gap-2">
            {quote.lineItems.map((item, index) => (
              <li key={`${item.code}-${index}`} className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">{item.label}</span>
                <span className={`font-mono font-medium tabular-nums ${item.amountCents < 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {item.amountCents < 0 ? '−' : ''}
                  {formatCentsAsDisplay(Math.abs(item.amountCents), quote.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-800 text-sm font-bold text-white">
            <span className="tracking-wide">Estimated Subtotal</span>
            <span className="font-mono text-xl text-amber-400 tracking-tight tabular-nums">
              {formatCentsAsDisplay(quote.totalCents, quote.currency)}
            </span>
          </div>
        </div>
      )}

      {isLoading && !quote && (
        <div className="flex flex-col gap-2 animate-pulse py-2">
          <div className="h-4 bg-slate-800 rounded w-3/4" />
          <div className="h-4 bg-slate-800 rounded w-1/2" />
          <div className="h-6 bg-slate-800 rounded w-full mt-2" />
        </div>
      )}
    </div>
  );
}
