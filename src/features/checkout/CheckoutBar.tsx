import { useState, useCallback, useMemo } from 'react';
import type { PriceQuote } from '../../domain/schemas';
import type { CartService, ShopifyCartPayload } from '../../services/interfaces';
import { formatCentsAsDisplay } from '../../domain/pricing/pricing-engine';
import {
  useConfiguratorStore,
  selectConfiguration,
  selectProductDefinition,
  selectCurrentOptions,
  selectQuantity,
} from '../configurator/configurator.store';

interface CheckoutBarProps {
  cartService: CartService;
  currentQuote: PriceQuote | null;
  designNotes?: string;
  onDesignNotesChange?: (notes: string) => void;
}

/**
 * Sticky checkout bar — shows product summary, interactive quantity stepper,
 * live price, Add to Cart button, design notes, and Shopify JSON inspector.
 */
export function CheckoutBar({
  cartService,
  currentQuote,
  designNotes: externalNotes,
  onDesignNotesChange,
}: CheckoutBarProps) {
  const configuration = useConfiguratorStore(selectConfiguration);
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const quantity = useConfiguratorStore(selectQuantity);
  const setQuantity = useConfiguratorStore((s) => s.setQuantity);

  const [internalNotes, setInternalNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showCartInspector, setShowCartInspector] = useState(false);
  const [lastPayload, setLastPayload] = useState<ShopifyCartPayload | null>(null);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const notesValue = externalNotes !== undefined ? externalNotes : internalNotes;
  const setNotesValue = onDesignNotesChange ?? setInternalNotes;

  /* Real-time active cart payload (previewable before and after submission) */
  const activePayload = useMemo(() => {
    if (!configuration || !currentQuote || !productDef) return lastPayload;

    const frameType = currentOptions['frame-type'] ?? 'with-frame';
    const sideWalls = currentOptions['side-walls'] ?? 'none';
    const halfWalls = currentOptions['half-walls'] ?? 'none';
    const variantKey = `${frameType}:${sideWalls}:${halfWalls}`;
    const variant = productDef.shopify.variantMap[variantKey];

    if (!variant) return lastPayload;

    return cartService.buildCartPayload(
      configuration,
      currentQuote,
      variant.variantId,
      notesValue,
    );
  }, [configuration, currentQuote, productDef, currentOptions, cartService, notesValue, lastPayload]);

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
      notesValue,
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
  }, [configuration, currentQuote, productDef, currentOptions, cartService, notesValue]);

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
            <div className="checkout-product-title-row">
              <h3 className="checkout-product-name">
                {productDef?.name ?? 'Product'}
              </h3>
              <button
                type="button"
                className={`checkout-notes-btn ${notesValue.trim() ? 'has-notes' : ''}`}
                onClick={() => setShowNotesModal((prev) => !prev)}
                title="Add PMS Pantone colors or special printing instructions"
              >
                {notesValue.trim() ? '📝 Notes Added' : '+ Instructions'}
              </button>
            </div>
            <p className="checkout-variant-summary">{optionSummary}</p>
          </div>
        </div>

        <div className="checkout-price-actions">
          {/* Interactive Volume Quantity Stepper */}
          <div className="checkout-quantity-stepper" aria-label="Select item quantity">
            <button
              type="button"
              className="quantity-btn"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || isAdding}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="quantity-display" title={`Order quantity: ${quantity}`} aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="quantity-btn"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= 99 || isAdding}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

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

      {/* Design Notes & Printing Instructions Modal */}
      {showNotesModal && (
        <div className="checkout-notes-popover">
          <div className="checkout-notes-header">
            <h4>🎨 Custom Printing Instructions / PMS Codes</h4>
            <button
              type="button"
              className="checkout-notes-close"
              onClick={() => setShowNotesModal(false)}
            >
              ×
            </button>
          </div>
          <p className="checkout-notes-desc">
            Provide PMS / Pantone color match codes or placement notes for our pre-press team.
          </p>
          <textarea
            className="checkout-notes-textarea"
            placeholder="e.g. Roof: PMS 286 Blue, Valance: PMS 186 Red. Center logo 3 inches above valance seam."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className="checkout-notes-footer">
            <span className="checkout-notes-count">{notesValue.length}/500</span>
            <button
              type="button"
              className="checkout-notes-done-btn"
              onClick={() => setShowNotesModal(false)}
            >
              Save Instructions
            </button>
          </div>
        </div>
      )}

      {/* Shopify Payload Inspector — shows exactly what would be sent */}
      {showCartInspector && activePayload && (
        <div className="cart-inspector">
          <div className="cart-inspector-header">
            <h4>Shopify Cart Payload Inspector</h4>
            <button onClick={() => setShowCartInspector(false)}>×</button>
          </div>
          <pre className="cart-inspector-json">
            {JSON.stringify(activePayload, null, 2)}
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
