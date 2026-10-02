import { z } from 'zod';

/** Allowed font families for text layers — prevents arbitrary font injection */
export const ALLOWED_FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Inter',
  'Roboto',
  'Oswald',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Poppins',
  'Bebas Neue',
] as const;

export const FontFamilySchema = z.enum(ALLOWED_FONT_FAMILIES);

/** Hex color string (3, 4, 6, or 8 digits) */
export const HexColorSchema = z.string().regex(
  /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  'Invalid hex color format',
);

/** Text alignment options */
export const TextAlignSchema = z.enum(['left', 'center', 'right']);

/**
 * Base fields shared by all design layer types.
 * Positions are normalised (0-1) within the parent region's bounds.
 */
const BaseLayerSchema = z.object({
  id: z.string().uuid(),
  regionId: z.string().min(1),
  /** Normalised X position within the region (0 = left edge, 1 = right edge) */
  normalizedX: z.number().min(0).max(1),
  /** Normalised Y position within the region (0 = top edge, 1 = bottom edge) */
  normalizedY: z.number().min(0).max(1),
  rotationDegrees: z.number().min(-360).max(360),
  /** Scale multiplier (1 = original size relative to region) */
  scale: z.number().positive().max(10),
  opacity: z.number().min(0).max(1),
  zIndex: z.number().int().min(0),
  visible: z.boolean(),
  locked: z.boolean(),
});

/** A text overlay on the product surface */
export const TextLayerSchema = BaseLayerSchema.extend({
  kind: z.literal('text'),
  content: z.string().max(200),
  fontFamily: FontFamilySchema,
  /** Font size in points (relative to region physical size) */
  fontSizePt: z.number().positive().max(200),
  fill: HexColorSchema,
  align: TextAlignSchema,
});

/** Image fit modes for uploaded artwork */
export const ImageFitSchema = z.enum(['contain', 'cover', 'fill']);

/** An image overlay on the product surface */
export const ImageLayerSchema = BaseLayerSchema.extend({
  kind: z.literal('image'),
  /** Reference to an asset in the AssetRegistry by ID */
  assetId: z.string().uuid(),
  fit: ImageFitSchema,
  /** Normalised width within region (0-1) */
  normalizedWidth: z.number().positive().max(1),
  /** Normalised height within region (0-1) */
  normalizedHeight: z.number().positive().max(1),
});

/**
 * DesignLayer — discriminated union of text and image layers.
 * The `kind` field determines the layer type at runtime.
 */
export const DesignLayerSchema = z.discriminatedUnion('kind', [
  TextLayerSchema,
  ImageLayerSchema,
]);

/** Configuration for a single product section */
export const SectionConfigSchema = z.object({
  baseColor: HexColorSchema,
  layers: z.array(DesignLayerSchema),
});

/** Uploaded image asset metadata — the actual blob lives in the AssetRegistry */
export const AssetEntrySchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  pixelWidth: z.number().int().positive(),
  pixelHeight: z.number().int().positive(),
  byteSize: z.number().int().positive(),
  /** Object URL for rendering — must be revoked on removal */
  objectUrl: z.string(),
});

/**
 * Configuration — the complete customer design state.
 * This is what gets serialized, stored, and sent to the pricing/cart APIs.
 */
export const ConfigurationSchema = z.object({
  schemaVersion: z.number().int().positive(),
  configurationId: z.string().uuid(),
  productId: z.string().min(1),
  sizeId: z.string().min(1),
  /** Selected choice ID per option group ID */
  options: z.record(z.string(), z.string()),
  /** Section configurations keyed by section ID */
  sections: z.record(z.string(), SectionConfigSchema),
});

/* ───── Inferred TypeScript types ───── */

export type FontFamily = z.infer<typeof FontFamilySchema>;
export type HexColor = z.infer<typeof HexColorSchema>;
export type TextAlign = z.infer<typeof TextAlignSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type ImageFit = z.infer<typeof ImageFitSchema>;
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type DesignLayer = z.infer<typeof DesignLayerSchema>;
export type SectionConfig = z.infer<typeof SectionConfigSchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type Configuration = z.infer<typeof ConfigurationSchema>;
