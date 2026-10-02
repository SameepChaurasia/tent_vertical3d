import type { ProductDefinition } from '../schemas';

/**
 * Print regions for the canopy tent's pyramid-unwrap UV layout.
 *
 * The fabric texture is a 2D unwrap of the tent canopy:
 * - 4 triangular roof panels meeting at the centre
 * - 4 rectangular valance strips (the vertical edges hanging down)
 *
 * UV coordinates estimated from the fabric base-colour texture layout.
 * These can be tuned if the actual UV mapping differs slightly.
 */
const CANOPY_PRINT_REGIONS = [
  /* ── Roof panels (triangular) ── */
  {
    id: 'roof-front',
    label: 'Front Roof Panel',
    uvPolygon: [
      { u: 0.5, v: 0.5 },
      { u: 0.256, v: 0.886 },
      { u: 0.745, v: 0.886 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 60,
  },
  {
    id: 'roof-back',
    label: 'Back Roof Panel',
    uvPolygon: [
      { u: 0.5, v: 0.5 },
      { u: 0.256, v: 0.116 },
      { u: 0.745, v: 0.116 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 60,
  },
  {
    id: 'roof-left',
    label: 'Left Roof Panel',
    uvPolygon: [
      { u: 0.5, v: 0.5 },
      { u: 0.116, v: 0.256 },
      { u: 0.116, v: 0.745 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 60,
  },
  {
    id: 'roof-right',
    label: 'Right Roof Panel',
    uvPolygon: [
      { u: 0.5, v: 0.5 },
      { u: 0.886, v: 0.256 },
      { u: 0.886, v: 0.745 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 60,
  },

  /* ── Valance strips (rectangular) ── */
  {
    id: 'valance-front',
    label: 'Front Valance',
    uvPolygon: [
      { u: 0.256, v: 0.886 },
      { u: 0.745, v: 0.886 },
      { u: 0.745, v: 0.969 },
      { u: 0.256, v: 0.969 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 12,
  },
  {
    id: 'valance-back',
    label: 'Back Valance',
    uvPolygon: [
      { u: 0.256, v: 0.034 },
      { u: 0.745, v: 0.034 },
      { u: 0.745, v: 0.116 },
      { u: 0.256, v: 0.116 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 12,
  },
  {
    id: 'valance-left',
    label: 'Left Valance',
    uvPolygon: [
      { u: 0.034, v: 0.256 },
      { u: 0.116, v: 0.256 },
      { u: 0.116, v: 0.745 },
      { u: 0.034, v: 0.745 },
    ],
    physicalWidthInches: 12,
    physicalHeightInches: 120,
  },
  {
    id: 'valance-right',
    label: 'Right Valance',
    uvPolygon: [
      { u: 0.886, v: 0.256 },
      { u: 0.969, v: 0.256 },
      { u: 0.969, v: 0.745 },
      { u: 0.886, v: 0.745 },
    ],
    physicalWidthInches: 12,
    physicalHeightInches: 120,
  },
];

const WALL_PRINT_REGIONS = [
  {
    id: 'wall-full',
    label: 'Full Wall',
    uvPolygon: [
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 76,
  },
];

const HALF_WALL_PRINT_REGIONS = [
  {
    id: 'half-wall',
    label: 'Half Wall',
    uvPolygon: [
      { u: 0.0, v: 0.0 },
      { u: 1.0, v: 0.0 },
      { u: 1.0, v: 1.0 },
      { u: 0.0, v: 1.0 },
    ],
    physicalWidthInches: 120,
    physicalHeightInches: 38,
  },
];

/**
 * Product definition for the 10×10 Logo Canopy Tent.
 *
 * This is the single data file that describes the entire canopy tent product.
 * The configurator UI, 3D viewer, and 2D editor all derive their behaviour
 * from this definition — no product-specific logic lives in components.
 */
export const CANOPY_TENT_PRODUCT: ProductDefinition = {
  id: 'canopy-tent-10x10',
  name: '10x10 Logo Canopy Tent',
  schemaVersion: 1,

  models: {
    'size-5x5': {
      url: '/models/canopy-5x5.glb',
      label: "5'×5' Canopy",
      physicalWidthInches: 60,
      physicalDepthInches: 60,
      physicalHeightInches: 84,
      nodeMap: {
        fabric: 'fabric',
        legs: 'leg5',
        mechanism: 'mechanism3',
      },
      materialMap: {
        fabricOuter: 'fabric_Mat',
        fabricInner: 'Inner_fabric',
        metal: 'Metal_mat',
      },
    },
    'size-6.5x6.5': {
      url: '/models/canopy-6-5x6-5.glb',
      label: "6.5'×6.5' Canopy",
      physicalWidthInches: 78,
      physicalDepthInches: 78,
      physicalHeightInches: 84,
      nodeMap: {
        fabric: 'fabric',
        legs: 'leg',
        mechanism: 'mechanism',
      },
      materialMap: {
        fabricOuter: 'fabric_Mat',
        fabricInner: 'Inner_fabric',
        metal: 'Metal_mat',
      },
    },
    'size-8x8': {
      url: '/models/canopy-8x8.glb',
      label: "8'×8' Canopy",
      physicalWidthInches: 96,
      physicalDepthInches: 96,
      physicalHeightInches: 103,
      nodeMap: {
        fabric: 'fabric',
        legs: 'leg',
        mechanism: 'mechanism',
      },
      materialMap: {
        fabricOuter: 'fabric_Mat',
        fabricInner: 'Inner_fabric',
        metal: 'Metal_mat',
      },
    },
  },

  sections: [
    {
      id: 'canopy',
      label: 'Canopy',
      kind: 'printable',
      printRegions: CANOPY_PRINT_REGIONS.map((r) => ({ ...r, uvPolygon: [...r.uvPolygon] })),
    },
    {
      id: 'frame',
      label: 'Frame',
      kind: 'finish',
      printRegions: [],
    },
    {
      id: 'side-walls',
      label: 'Side Walls',
      kind: 'printable',
      printRegions: [...WALL_PRINT_REGIONS],
      activeWhen: {
        'side-walls': [
          'wall-1-single',
          'wall-1-double',
          'wall-3-single',
          'wall-3-double',
        ],
      },
    },
    {
      id: 'half-walls',
      label: 'Half Walls',
      kind: 'printable',
      printRegions: [...HALF_WALL_PRINT_REGIONS],
      activeWhen: {
        'half-walls': ['half-wall-single', 'half-wall-double'],
      },
    },
  ],

  optionGroups: [
    {
      id: 'frame-type',
      label: 'Size',
      choices: [
        {
          id: 'with-frame',
          label: "10'x10' Canopy with Frame",
          isDefault: true,
        },
        {
          id: 'canopy-only',
          label: "10'x10' Canopy Only (No Frame)",
          isDefault: false,
        },
      ],
    },
    {
      id: 'side-walls',
      label: 'Side Walls',
      choices: [
        { id: 'none', label: 'None', isDefault: true },
        { id: 'wall-1-single', label: '(1) 10ft Side Wall: Single Sided Print', isDefault: false },
        { id: 'wall-1-double', label: '(1) 10ft Side Wall: Double Sided Print', isDefault: false },
        { id: 'wall-3-single', label: '(3) 10ft Side Walls: Single Sided Print', isDefault: false },
        { id: 'wall-3-double', label: '(3) 10ft Side Walls: Double Sided Print', isDefault: false },
      ],
    },
    {
      id: 'half-walls',
      label: 'Half Walls (Set of 2)',
      choices: [
        { id: 'none', label: 'None', isDefault: true },
        {
          id: 'half-wall-single',
          label: 'Half Walls (Set of 2): Single Sided Print',
          isDefault: false,
        },
        {
          id: 'half-wall-double',
          label: 'Half Walls (Set of 2): Double Sided Print',
          isDefault: false,
        },
      ],
    },
  ],

  shopify: {
    productHandle: '10x10-custom-canopy-tent',
    productId: '9483794317560',
    variantMap: {
      /* Size + Walls + Half Walls → Shopify variant */
      'with-frame:none:none': {
        variantId: '48270445478136',
        sku: 'TENT-10X10-FRAME',
      },
      'canopy-only:none:none': {
        variantId: '48270445510904',
        sku: 'TENT-10X10-CANOPY',
      },
      'with-frame:wall-1-single:none': {
        variantId: '48270445543672',
        sku: 'TENT-10X10-FRAME-1W-S',
      },
      'with-frame:wall-1-double:none': {
        variantId: '48270445576440',
        sku: 'TENT-10X10-FRAME-1W-D',
      },
      'with-frame:wall-3-single:none': {
        variantId: '48270445609208',
        sku: 'TENT-10X10-FRAME-3W-S',
      },
      'with-frame:wall-3-double:none': {
        variantId: '48270445641976',
        sku: 'TENT-10X10-FRAME-3W-D',
      },
      'with-frame:none:half-wall-single': {
        variantId: '48270445674744',
        sku: 'TENT-10X10-FRAME-HW-S',
      },
      'with-frame:none:half-wall-double': {
        variantId: '48270445707512',
        sku: 'TENT-10X10-FRAME-HW-D',
      },
    },
  },

  pricing: {
    currency: 'USD',
    quoteEndpointPath: '/api/pricing/quote',
  },
};
