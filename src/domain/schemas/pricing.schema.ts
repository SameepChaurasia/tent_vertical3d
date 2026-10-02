import { z } from 'zod';

/** Individual line item in a price quote */
export const QuoteLineItemSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  /** Amount in the smallest currency unit (cents for USD) */
  amountCents: z.number().int(),
});

/** A complete price quote returned by the pricing service */
export const PriceQuoteSchema = z.object({
  currency: z.string().length(3),
  lineItems: z.array(QuoteLineItemSchema).min(1),
  subtotalCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  quoteId: z.string().uuid(),
  /** HMAC signature for tamper detection */
  signature: z.string().min(1),
  /** ISO 8601 timestamp — quotes expire to prevent stale pricing */
  expiresAt: z.string().datetime(),
  /** Optional quantity for multi-item quotes */
  quantity: z.number().int().positive().optional(),
});

/** Pricing rule: a delta applied when a specific option choice is selected */
export const PricingRuleSchema = z.object({
  optionGroupId: z.string().min(1),
  choiceId: z.string().min(1),
  deltaCents: z.number().int(),
  label: z.string().min(1),
});

/** Override for specific option combinations that don't sum cleanly */
export const PricingOverrideSchema = z.object({
  /** Combination key: "optionGroup1:choice1|optionGroup2:choice2" */
  combinationKey: z.string().min(1),
  totalCents: z.number().int().nonnegative(),
  label: z.string().min(1),
});

/** Complete pricing definition for a product */
export const PricingDefinitionSchema = z.object({
  basePriceCents: z.number().int().nonnegative(),
  rules: z.array(PricingRuleSchema),
  overrides: z.array(PricingOverrideSchema),
  /** Optional customization surcharges */
  surcharges: z.array(
    z.object({
      code: z.string().min(1),
      label: z.string().min(1),
      conditionDescription: z.string().min(1),
      amountCents: z.number().int().nonnegative(),
    }),
  ),
});

/** Request body sent to the pricing API */
export const QuoteRequestSchema = z.object({
  productId: z.string().min(1),
  sizeId: z.string().min(1),
  options: z.record(z.string(), z.string()),
  /** Number of custom images uploaded (affects surcharges) */
  customImageCount: z.number().int().nonnegative(),
  /** Number of custom text layers (affects surcharges) */
  customTextCount: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

/* ───── Inferred TypeScript types ───── */

export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;
export type PriceQuote = z.infer<typeof PriceQuoteSchema>;
export type PricingRule = z.infer<typeof PricingRuleSchema>;
export type PricingOverride = z.infer<typeof PricingOverrideSchema>;
export type PricingDefinition = z.infer<typeof PricingDefinitionSchema>;
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
