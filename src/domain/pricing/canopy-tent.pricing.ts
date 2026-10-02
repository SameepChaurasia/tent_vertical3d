import type { PricingDefinition } from '../schemas';

/**
 * Pricing rules for the 10×10 Canopy Tent.
 *
 * Base price: $849 (with frame), canopy only: $549 (delta: -$300).
 * All amounts in cents to avoid floating-point rounding issues.
 *
 * Data sourced from the MVP Visuals reference product page.
 * Some wall + half-wall combos have small bundle discounts — these
 * are captured in the overrides table rather than summed from rules.
 */
export const CANOPY_TENT_PRICING: PricingDefinition = {
  basePriceCents: 84900,

  rules: [
    /* ── Frame type ── */
    {
      optionGroupId: 'frame-type',
      choiceId: 'canopy-only',
      deltaCents: -30000,
      label: 'Canopy Only (No Frame)',
    },

    /* ── Side walls ── */
    {
      optionGroupId: 'side-walls',
      choiceId: 'wall-1-single',
      deltaCents: 19600,
      label: '(1) 10ft Side Wall: Single Sided',
    },
    {
      optionGroupId: 'side-walls',
      choiceId: 'wall-1-double',
      deltaCents: 31600,
      label: '(1) 10ft Side Wall: Double Sided',
    },
    {
      optionGroupId: 'side-walls',
      choiceId: 'wall-3-single',
      deltaCents: 58600,
      label: '(3) 10ft Side Walls: Single Sided',
    },
    {
      optionGroupId: 'side-walls',
      choiceId: 'wall-3-double',
      deltaCents: 94600,
      label: '(3) 10ft Side Walls: Double Sided',
    },

    /* ── Half walls ── */
    {
      optionGroupId: 'half-walls',
      choiceId: 'half-wall-single',
      deltaCents: 34000,
      label: 'Half Walls (Set of 2): Single Sided',
    },
    {
      optionGroupId: 'half-walls',
      choiceId: 'half-wall-double',
      deltaCents: 43600,
      label: 'Half Walls (Set of 2): Double Sided',
    },
  ],

  overrides: [
    /*
     * Bundle discounts: some wall + half-wall combos are slightly cheaper
     * than their additive sum. These override the rule-based calculation.
     * Keys sorted alphabetically by group ID: frame-type | half-walls | side-walls
     */
    {
      combinationKey: 'frame-type:with-frame|half-walls:half-wall-double|side-walls:wall-1-single',
      totalCents: 138700,
      label: '1 Wall Single + Half Walls Double Bundle',
    },
    {
      combinationKey: 'frame-type:with-frame|half-walls:half-wall-single|side-walls:wall-1-double',
      totalCents: 146300,
      label: '1 Wall Double + Half Walls Single Bundle',
    },
  ],

  surcharges: [
    {
      code: 'extra-artwork',
      label: 'Additional Artwork Processing',
      conditionDescription: 'Applied when more than 3 custom images are uploaded',
      amountCents: 2500,
    },
    {
      code: 'rush-design',
      label: 'Rush Design Service',
      conditionDescription: 'Mock surcharge for rush design requests',
      amountCents: 5000,
    },
  ],
};
