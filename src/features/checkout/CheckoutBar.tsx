import { useState, useCallback } from 'react';
import type { PriceQuote } from '../../domain/schemas';
import type { CartService, ShopifyCartPayload } from '../../services/interfaces';
import { formatCentsAsDisplay } from '../../domain/pricing/pricing-engine';
import {
  useConfiguratorStore,
  selectConfiguration,
  selectProductDefinition,
  selectCurrentOptions,
} from '../configurator/configurator.store';

interface CheckoutBarProps {
  cartService: CartService;
  currentQuote: PriceQuote | null;
}

/**
 * Sticky checkout bar — shows product summary, price, and Add to Cart button.
 * Also includes a JSON inspector showing the exact Shopify payload.
 */
export function CheckoutBar({ cartService, currentQuote }: CheckoutBarProps) {
  const configuration = useConfiguratorStore(selectConfiguration);
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);

  const [isAdding, setIsAdding] = useState(false);
  const [showCartInspector, setShowCartInspector] = useState(false);
  const [lastPayload, setLastPayload] = useState<ShopifyCartPayload | null>(null);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const handleAddToCart = useCallback(async () => {
    if (!configuration || !currentQuote || !productDef) return;

    setIsAdding(true);
    setCartError(null);
    setCartSuccess(false);

    /* Resolve variant ID from the variant map */
    const frameType = currentOptions['frame-type'] ?? 'with-frame';
    const sideWalls = currentOptions['side-walls'] ?? 'none';
    const halfWalls = currentOptions['half-walls'] ?? 'none';
    const variantKey = `${frameType}:${sideWalls}:${halfWalls}`;
    const variant = productDef.shopify.variantMap[variantKey];

    if (!variant) {
      setCartError('This combination is not available. Please adjust your options.');
      setIsAdding(false);
      return;
    }

    const payload = cartService.buildCartPayload(
      configuration,
      currentQuote,
      variant.variantId,
    );

    setLastPayload(payload);

    const result = await cartService.addToCart(payload);
    setIsAdding(false);

    if (result.success) {
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } else {
      setCartError(result.error ?? 'Failed to add to cart');
    }
  }, [configuration, currentQuote, productDef, currentOptions, cartService]);

  /* Build option summary for display */
  const optionSummary = productDef?.optionGroups
    .map((group) => {
      const selectedId = currentOptions[group.id];
      const choice = group.choices.find((c) => c.id === selectedId);
      return choice?.label ?? '';
    })
    .filter(Boolean)
    .join(' / ');

  return (
    <>
      <div className="checkout-bar">
        <div className="checkout-product-info">
          <div className="checkout-product-thumbnail">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M4 18l8-12 8 12M4 18h16" />
            </svg>
          </div>
          <div className="checkout-product-details">
            <h3 className="checkout-product-name">
              {productDef?.name ?? 'Product'}
            </h3>
            <p className="checkout-variant-summary">{optionSummary}</p>
          </div>
        </div>

        <div className="checkout-price-actions">
          <span className="checkout-price">
            {currentQuote
              ? formatCentsAsDisplay(currentQuote.totalCents, currentQuote.currency)
              : '—'}
          </span>

          <button
            className={`checkout-add-to-cart ${cartSuccess ? 'checkout-success' : ''}`}
            onClick={handleAddToCart}
            disabled={isAdding || !currentQuote}
          >
            {isAdding
              ? 'Adding...'
              : cartSuccess
                ? '✓ Added!'
                : 'ADD TO CART'}
          </button>

          <button
            className="checkout-inspector-toggle"
            onClick={() => setShowCartInspector((prev) => !prev)}
            title="Show Shopify Payload Inspector"
          >
            { }
          </button>
        </div>
      </div>

      {cartError && (
        <div className="checkout-error" role="alert">
          {cartError}
        </div>
      )}

      {/* Shopify Payload Inspector — shows exactly what would be sent */}
      {showCartInspector && lastPayload && (
        <div className="cart-inspector">
          <div className="cart-inspector-header">
            <h4>Shopify Cart Payload Inspector</h4>
            <button onClick={() => setShowCartInspector(false)}>×</button>
          </div>
          <pre className="cart-inspector-json">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
          <p className="cart-inspector-note">
            This is the exact payload that would be sent to Shopify&apos;s{' '}
            <code>/cart/add.js</code> API. Properties prefixed with underscore
            are hidden from the customer at checkout.
          </p>
        </div>
      )}
    </>
  );
}
