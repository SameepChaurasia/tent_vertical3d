import { z } from 'zod';

/**
 * UV polygon vertex — normalised coordinates (0-1) within the texture space.
 * Used to define printable regions on the tent surface.
 */
export const UvPointSchema = z.object({
  u: z.number().min(0).max(1),
  v: z.number().min(0).max(1),
});

/**
 * A printable region on a product section, defined by its UV polygon
 * and physical dimensions for DPI calculations.
 */
export const PrintRegionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  uvPolygon: z.array(UvPointSchema).min(3),
  physicalWidthInches: z.number().positive(),
  physicalHeightInches: z.number().positive(),
});

/** Maps model-specific node names so the viewer can locate geometry by role */
export const NodeMapSchema = z.object({
  fabric: z.string().min(1),
  legs: z.string().min(1),
  mechanism: z.string().min(1),
});

/** Maps model-specific material names so textures can be swapped by role */
export const MaterialMapSchema = z.object({
  fabricOuter: z.string().min(1),
  fabricInner: z.string().min(1),
  metal: z.string().min(1),
});

/** A 3D model variant keyed by size */
export const ModelVariantSchema = z.object({
  url: z.string().url().or(z.string().startsWith('/')),
  label: z.string().min(1),
  physicalWidthInches: z.number().positive(),
  physicalDepthInches: z.number().positive(),
  physicalHeightInches: z.number().positive(),
  nodeMap: NodeMapSchema,
  materialMap: MaterialMapSchema,
});

export const SectionKind = z.enum(['printable', 'finish', 'accessory']);

/** A customizable section of the product (e.g., canopy, side walls) */
export const SectionDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: SectionKind,
  printRegions: z.array(PrintRegionSchema).default([]),
  /** Section is only active when these option conditions are met */
  activeWhen: z
    .record(z.string(), z.array(z.string()))
    .optional(),
});

/** A single choice within an option group */
export const OptionChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Whether this choice is the default selection */
  isDefault: z.boolean().default(false),
});

/** A group of mutually exclusive options (e.g., "Side Walls") */
export const OptionGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  choices: z.array(OptionChoiceSchema).min(1),
  /** Dependencies: this group is only shown when parent conditions are met */
  visibleWhen: z
    .record(z.string(), z.array(z.string()))
    .optional(),
});

/** Shopify variant mapping: option combination key → variant data */
export const ShopifyVariantSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().min(1),
});

/** Shopify integration metadata for this product */
export const ShopifyConfigSchema = z.object({
  productHandle: z.string().min(1),
  productId: z.string().min(1),
  /** Maps "sizeId:wallsId:halfWallsId" → variant data */
  variantMap: z.record(z.string(), ShopifyVariantSchema),
});

/** Pricing configuration */
export const PricingConfigSchema = z.object({
  currency: z.string().length(3),
  quoteEndpointPath: z.string().min(1),
});

/**
 * ProductDefinition — the complete, product-agnostic schema for any configurable product.
 * Adding a new product requires only a new definition file, not new components.
 */
export const ProductDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  models: z.record(z.string(), ModelVariantSchema),
  sections: z.array(SectionDefinitionSchema).min(1),
  optionGroups: z.array(OptionGroupSchema).min(1),
  shopify: ShopifyConfigSchema,
  pricing: PricingConfigSchema,
});

/* ───── Inferred TypeScript types ───── */

export type UvPoint = z.infer<typeof UvPointSchema>;
export type PrintRegion = z.infer<typeof PrintRegionSchema>;
export type NodeMap = z.infer<typeof NodeMapSchema>;
export type MaterialMap = z.infer<typeof MaterialMapSchema>;
export type ModelVariant = z.infer<typeof ModelVariantSchema>;
export type SectionDefinition = z.infer<typeof SectionDefinitionSchema>;
export type OptionChoice = z.infer<typeof OptionChoiceSchema>;
export type OptionGroup = z.infer<typeof OptionGroupSchema>;
export type ShopifyVariant = z.infer<typeof ShopifyVariantSchema>;
export type ShopifyConfig = z.infer<typeof ShopifyConfigSchema>;
export type PricingConfig = z.infer<typeof PricingConfigSchema>;
export type ProductDefinition = z.infer<typeof ProductDefinitionSchema>;
