import { describe, it, expect, beforeEach } from 'vitest';
import { useConfiguratorStore } from '../src/features/configurator/configurator.store';
import { CANOPY_TENT_PRODUCT } from '../src/domain/products/canopy-tent.product';
import { CANOPY_TENT_PRICING } from '../src/domain/pricing/canopy-tent.pricing';
import { computeQuoteLineItems, formatCentsAsDisplay } from '../src/domain/pricing/pricing-engine';
import { MockCartService } from '../src/services/mock/mock-cart.service';
import type { QuoteRequest } from '../src/domain/schemas';

describe('Configurator End-to-End Integration Flow', () => {
  const cartService = new MockCartService();

  beforeEach(() => {
    useConfiguratorStore.getState().initializeProduct(CANOPY_TENT_PRODUCT);
  });

  it('initializes with valid default configuration and base price', () => {
    const state = useConfiguratorStore.getState();
    const config = state.configuration;

    expect(config).not.toBeNull();
    expect(config?.productId).toBe('canopy-tent-10x10');
    expect(config?.sizeId).toBe('size-5x5');
    expect(config?.options['frame-type']).toBe('with-frame');
    expect(config?.options['side-walls']).toBe('none');
    expect(config?.options['half-walls']).toBe('none');

    /* Initial price quote */
    const quoteReq: QuoteRequest = {
      productId: config!.productId,
      sizeId: config!.sizeId,
      options: config!.options,
      quantity: 1,
      customImageCount: 0,
    };

    const quote = computeQuoteLineItems(quoteReq, CANOPY_TENT_PRICING);
    expect(quote.totalCents).toBe(84900);
    expect(formatCentsAsDisplay(quote.totalCents)).toBe('$849.00');
  });

  it('updates pricing correctly when side walls and half walls change', () => {
    const store = useConfiguratorStore.getState();

    /* Add 1 single side wall (+$196) */
    store.setOption('side-walls', 'wall-1-single');
    let config = useConfiguratorStore.getState().configuration!;

    let quote = computeQuoteLineItems(
      {
        productId: config.productId,
        sizeId: config.sizeId,
        options: config.options,
        quantity: 1,
        customImageCount: 0,
      },
      CANOPY_TENT_PRICING,
    );
    expect(quote.totalCents).toBe(84900 + 19600); // $1,045.00

    /* Switch to 3 double-sided side walls (+$946) */
    store.setOption('side-walls', 'wall-3-double');
    config = useConfiguratorStore.getState().configuration!;

    quote = computeQuoteLineItems(
      {
        productId: config.productId,
        sizeId: config.sizeId,
        options: config.options,
        quantity: 1,
        customImageCount: 0,
      },
      CANOPY_TENT_PRICING,
    );
    expect(quote.totalCents).toBe(84900 + 94600); // $1,795.00
  });

  it('applies bundle overrides when eligible combo is selected', () => {
    const store = useConfiguratorStore.getState();

    /* 1 wall single + half walls double has a bundle override */
    store.setOption('side-walls', 'wall-1-single');
    store.setOption('half-walls', 'half-wall-double');

    const config = useConfiguratorStore.getState().configuration!;
    const quote = computeQuoteLineItems(
      {
        productId: config.productId,
        sizeId: config.sizeId,
        options: config.options,
        quantity: 1,
        customImageCount: 0,
      },
      CANOPY_TENT_PRICING,
    );

    /* Bundle override total: $1,387.00 */
    expect(quote.totalCents).toBe(138700);
    expect(quote.lineItems[0]?.code).toBe('bundle-price');
  });

  it('resolves the correct Shopify variant and builds complete cart payload', async () => {
    const store = useConfiguratorStore.getState();
    store.setOption('side-walls', 'wall-1-single');

    const config = useConfiguratorStore.getState().configuration!;

    /* Build quote */
    const quoteReq: QuoteRequest = {
      productId: config.productId,
      sizeId: config.sizeId,
      options: config.options,
      quantity: 1,
      customImageCount: 0,
    };
    const { lineItems, totalCents } = computeQuoteLineItems(quoteReq, CANOPY_TENT_PRICING);

    const priceQuote = {
      quoteId: 'test-quote',
      productId: config.productId,
      currency: 'USD',
      unitPriceCents: totalCents,
      quantity: 1,
      totalCents,
      lineItems,
      validUntilIso: new Date(Date.now() + 3600000).toISOString(),
    };

    /* Resolve Shopify variant */
    const frameType = config.options['frame-type'] ?? 'with-frame';
    const sideWalls = config.options['side-walls'] ?? 'none';
    const halfWalls = config.options['half-walls'] ?? 'none';
    const variantKey = `${frameType}:${sideWalls}:${halfWalls}`;
    const variant = CANOPY_TENT_PRODUCT.shopify.variantMap[variantKey];

    expect(variant).toBeDefined();
    expect(variant?.variantId).toBe('48270445543672');
    expect(variant?.sku).toBe('TENT-10X10-FRAME-1W-S');

    /* Build Shopify payload via CartService */
    const payload = cartService.buildCartPayload(
      config,
      priceQuote,
      variant!.variantId,
    );

    expect(payload.id).toBe('48270445543672');
    expect(payload.properties['_configuration_id']).toBe(config.configurationId);
    expect(payload.properties['Price']).toBe('$1,045.00');

    /* Add to cart */
    const result = await cartService.addToCart(payload);
    expect(result.success).toBe(true);
    expect(cartService.getCartItems()).toHaveLength(1);
    expect(cartService.getCartItems()[0]?.id).toBe('48270445543672');
  });

  it('handles 2D layer creation, modification, and undo/redo history', () => {
    const store = useConfiguratorStore.getState();

    /* Add text layer */
    const textLayerId = store.addTextLayer('canopy', 'roof-front', {
      content: 'Antigravity Expo 2026',
      fill: '#00E5FF',
    });

    let config = useConfiguratorStore.getState().configuration!;
    expect(config.sections['canopy']?.layers).toHaveLength(1);
    expect(config.sections['canopy']?.layers[0]?.content).toBe('Antigravity Expo 2026');

    /* Update layer transform */
    store.updateLayer('canopy', textLayerId, {
      normalizedX: 0.5,
      normalizedY: 0.35,
      rotationDegrees: 15,
    });

    config = useConfiguratorStore.getState().configuration!;
    expect(config.sections['canopy']?.layers[0]?.rotationDegrees).toBe(15);

    /* Undo */
    expect(useConfiguratorStore.getState().undoStack.length).toBeGreaterThan(0);
    store.undo();

    config = useConfiguratorStore.getState().configuration!;
    expect(config.sections['canopy']?.layers[0]?.rotationDegrees).toBe(0);

    /* Redo */
    store.redo();
    config = useConfiguratorStore.getState().configuration!;
    expect(config.sections['canopy']?.layers[0]?.rotationDegrees).toBe(15);
  });

  it('supports round-trip export and import of full configuration JSON', () => {
    const store = useConfiguratorStore.getState();
    store.setOption('side-walls', 'wall-3-single');
    store.setSectionBaseColor('canopy', '#0A84FF');
    store.addTextLayer('canopy', 'roof-front', { content: 'ROUND TRIP TEST' });

    const exported = store.exportConfiguration();
    expect(exported).not.toBeNull();
    expect(exported?.sections['canopy']?.baseColor).toBe('#0A84FF');
    expect(exported?.options['side-walls']).toBe('wall-3-single');

    /* Reset to default */
    store.resetConfiguration();
    expect(useConfiguratorStore.getState().configuration?.sections['canopy']?.baseColor).toBe('#F5A623');

    /* Re-import */
    store.importConfiguration(exported!);
    const restored = useConfiguratorStore.getState().configuration!;
    expect(restored.sections['canopy']?.baseColor).toBe('#0A84FF');
    expect(restored.options['side-walls']).toBe('wall-3-single');
    expect(restored.sections['canopy']?.layers).toHaveLength(1);
  });

  it('handles multi-item quantity scaling and injects volume quantity into Shopify cart payload', async () => {
    useConfiguratorStore.getState().setQuantity(4);
    expect(useConfiguratorStore.getState().quantity).toBe(4);

    const config = useConfiguratorStore.getState().configuration!;
    const quoteReq: QuoteRequest = {
      productId: config.productId,
      sizeId: config.sizeId,
      options: config.options,
      quantity: 4,
      customImageCount: 0,
    };

    const quote = computeQuoteLineItems(quoteReq, CANOPY_TENT_PRICING);
    expect(quote.totalCents).toBe(84900 * 4); // $3,396.00

    const priceQuote = {
      quoteId: 'quote-qty-4',
      productId: config.productId,
      currency: 'USD',
      unitPriceCents: 84900,
      quantity: 4,
      totalCents: quote.totalCents,
      lineItems: quote.lineItems,
      signature: 'mock-sig-qty4',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const payload = cartService.buildCartPayload(
      config,
      priceQuote,
      '48270445478136',
    );

    expect(payload.quantity).toBe(4);
    expect(payload.properties['Price']).toBe('$3,396.00');

    const result = await cartService.addToCart(payload);
    expect(result.success).toBe(true);
  });

  it('switches canopy dimensions and embeds custom design notes / PMS instructions into cart properties', async () => {
    /* Switch size to 8x8 */
    useConfiguratorStore.getState().setSize('size-8x8');
    expect(useConfiguratorStore.getState().configuration?.sizeId).toBe('size-8x8');

    const model8x8 = CANOPY_TENT_PRODUCT.models['size-8x8'];
    expect(model8x8).toBeDefined();
    expect(model8x8?.physicalWidthInches).toBe(96);
    expect(model8x8?.physicalHeightInches).toBe(103);

    const config = useConfiguratorStore.getState().configuration!;
    const priceQuote = {
      quoteId: 'quote-notes-test',
      productId: config.productId,
      currency: 'USD',
      unitPriceCents: 84900,
      quantity: 1,
      totalCents: 84900,
      lineItems: [{ code: 'base-price', label: 'Base Product', amountCents: 84900 }],
      signature: 'mock-sig-notes',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    /* Build payload with custom Pantone notes */
    const notes = 'PMS 286 Blue, align logo 2 inches above valance seam';
    const payload = cartService.buildCartPayload(
      config,
      priceQuote,
      '48270445478136',
      notes,
    );

    expect(payload.properties['Design Notes']).toBe(notes);
    expect(payload.properties['_configuration_id']).toBe(config.configurationId);

    /* Verify empty notes are not added to payload */
    const emptyPayload = cartService.buildCartPayload(
      config,
      priceQuote,
      '48270445478136',
      '   ',
    );
    expect(emptyPayload.properties['Design Notes']).toBeUndefined();
  });
});
