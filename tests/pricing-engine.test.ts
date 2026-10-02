import { describe, it, expect } from 'vitest';
import { computeQuoteLineItems, formatCentsAsDisplay } from '../src/domain/pricing/pricing-engine';
import { CANOPY_TENT_PRICING } from '../src/domain/pricing/canopy-tent.pricing';
import type { QuoteRequest } from '../src/domain/schemas';

/**
 * Pricing Engine Tests
 *
 * These tests verify the core business logic of the pricing engine:
 * 1. Base price calculation for default options
 * 2. Option delta application (additive pricing)
 * 3. Override table for non-additive bundle combos
 * 4. Surcharge logic for extra artwork
 * 5. Quantity multiplication
 * 6. Currency formatting
 */

function makeRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    productId: 'canopy-tent-10x10',
    sizeId: 'size-5x5',
    options: {
      'frame-type': 'with-frame',
      'side-walls': 'none',
      'half-walls': 'none',
    },
    customImageCount: 0,
    customTextCount: 0,
    quantity: 1,
    ...overrides,
  };
}

describe('computeQuoteLineItems', () => {
  it('returns base price for default options', () => {
    const request = makeRequest();
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.totalCents).toBe(84900);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.code).toBe('base-price');
    expect(result.lineItems[0]?.amountCents).toBe(84900);
  });

  it('applies canopy-only discount (−$300)', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'canopy-only',
        'side-walls': 'none',
        'half-walls': 'none',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.totalCents).toBe(54900); // $849 - $300 = $549
    expect(result.lineItems).toHaveLength(2);

    const discount = result.lineItems.find((li) => li.amountCents < 0);
    expect(discount).toBeDefined();
    expect(discount?.amountCents).toBe(-30000);
  });

  it('adds single side wall pricing', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'with-frame',
        'side-walls': 'wall-1-single',
        'half-walls': 'none',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.totalCents).toBe(84900 + 19600);
    expect(result.lineItems.some((li) => li.code.includes('wall-1-single'))).toBe(true);
  });

  it('adds 3 side walls double-sided pricing', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'with-frame',
        'side-walls': 'wall-3-double',
        'half-walls': 'none',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.totalCents).toBe(84900 + 94600);
  });

  it('adds half wall pricing', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'with-frame',
        'side-walls': 'none',
        'half-walls': 'half-wall-single',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.totalCents).toBe(84900 + 34000);
  });

  it('combines wall + half wall pricing (additive)', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'with-frame',
        'side-walls': 'wall-3-single',
        'half-walls': 'half-wall-single',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    /* No override exists for this combo, so it should be additive */
    expect(result.totalCents).toBe(84900 + 58600 + 34000);
  });

  it('uses override for specific bundle combos instead of additive', () => {
    const request = makeRequest({
      options: {
        'frame-type': 'with-frame',
        'side-walls': 'wall-1-single',
        'half-walls': 'half-wall-double',
      },
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    /* Override exists for this combo: $1,387.00 */
    expect(result.totalCents).toBe(138700);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.code).toBe('bundle-price');
  });

  it('applies extra artwork surcharge for > 3 images', () => {
    const request = makeRequest({
      customImageCount: 5,
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    /* 2 extra images × $25 = $50 surcharge */
    const surcharge = result.lineItems.find((li) => li.code === 'extra-artwork');
    expect(surcharge).toBeDefined();
    expect(surcharge?.amountCents).toBe(5000);
    expect(result.totalCents).toBe(84900 + 5000);
  });

  it('does not apply surcharge for ≤ 3 images', () => {
    const request = makeRequest({
      customImageCount: 3,
    });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    const surcharge = result.lineItems.find((li) => li.code === 'extra-artwork');
    expect(surcharge).toBeUndefined();
    expect(result.totalCents).toBe(84900);
  });

  it('multiplies by quantity', () => {
    const request = makeRequest({ quantity: 3 });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    /* Base $849 × 3 = $2,547 */
    expect(result.totalCents).toBe(84900 * 3);
    expect(result.lineItems.some((li) => li.code === 'quantity')).toBe(true);
  });

  it('does not add quantity line item for quantity = 1', () => {
    const request = makeRequest({ quantity: 1 });
    const result = computeQuoteLineItems(request, CANOPY_TENT_PRICING);

    expect(result.lineItems.some((li) => li.code === 'quantity')).toBe(false);
  });
});

describe('formatCentsAsDisplay', () => {
  it('formats positive cents correctly', () => {
    expect(formatCentsAsDisplay(84900)).toBe('$849.00');
  });

  it('formats zero correctly', () => {
    expect(formatCentsAsDisplay(0)).toBe('$0.00');
  });

  it('formats fractional amounts correctly', () => {
    expect(formatCentsAsDisplay(199)).toBe('$1.99');
  });

  it('formats large amounts with comma separator', () => {
    expect(formatCentsAsDisplay(138700)).toBe('$1,387.00');
  });
});
