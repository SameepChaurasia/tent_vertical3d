import type {
  PricingDefinition,
  QuoteLineItem,
  QuoteRequest,
} from '../schemas';

/**
 * Builds the combination key used to look up overrides.
 * Format: "optionGroup1:choice1|optionGroup2:choice2|..."
 * Keys are sorted alphabetically for consistent lookup.
 */
function normalizeCombinationKey(key: string): string {
  return key
    .split('|')
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

/**
 * Builds the combination key used to look up overrides.
 * Format: "optionGroup1:choice1|optionGroup2:choice2|..."
 * Keys are sorted alphabetically for consistent lookup.
 */
function buildCombinationKey(options: Record<string, string>): string {
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupId, choiceId]) => `${groupId}:${choiceId}`)
    .join('|');
}

/**
 * Formats cents as a display string: "$8.49" for 849 cents.
 * Only used for labels, never for computation.
 */
export function formatCentsAsDisplay(cents: number, currency = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Pure pricing engine — computes a price quote from a request and pricing definition.
 *
 * ARCHITECTURE NOTE: This function is intentionally pure (no side effects,
 * no I/O) so it can be called both on the server (Vercel function) and
 * in tests. The server wraps it with HMAC signing; the client never calls
 * this directly — it goes through the PricingService interface.
 */
export function computeQuoteLineItems(
  request: QuoteRequest,
  pricingDef: PricingDefinition,
): { lineItems: QuoteLineItem[]; totalCents: number } {
  const lineItems: QuoteLineItem[] = [];
  const combinationKey = buildCombinationKey(request.options);

  /* Check for an exact override match first (order-insensitive) */
  const override = pricingDef.overrides.find(
    (o) => normalizeCombinationKey(o.combinationKey) === combinationKey,
  );

  if (override) {
    lineItems.push({
      code: 'bundle-price',
      label: override.label,
      amountCents: override.totalCents,
    });
  } else {
    /* Base price */
    lineItems.push({
      code: 'base-price',
      label: 'Base Product',
      amountCents: pricingDef.basePriceCents,
    });

    /* Apply rules for each selected option */
    for (const rule of pricingDef.rules) {
      const selectedChoice = request.options[rule.optionGroupId];
      if (selectedChoice === rule.choiceId) {
        lineItems.push({
          code: `option-${rule.optionGroupId}-${rule.choiceId}`,
          label: rule.label,
          amountCents: rule.deltaCents,
        });
      }
    }
  }

  /* Apply surcharges based on conditions */
  for (const surcharge of pricingDef.surcharges) {
    if (
      surcharge.code === 'extra-artwork' &&
      request.customImageCount > 3
    ) {
      const extraImages = request.customImageCount - 3;
      lineItems.push({
        code: surcharge.code,
        label: `${surcharge.label} (${extraImages} extra)`,
        amountCents: surcharge.amountCents * extraImages,
      });
    }
  }

  /* Quantity multiplication */
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );

  if (request.quantity > 1) {
    lineItems.push({
      code: 'quantity',
      label: `Quantity: ${request.quantity}`,
      amountCents: subtotalCents * (request.quantity - 1),
    });
  }

  const totalCents = lineItems.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );

  return { lineItems, totalCents };
}
