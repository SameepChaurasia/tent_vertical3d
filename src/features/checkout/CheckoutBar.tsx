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
      <div className="h-[68px] px-6 flex items-center justify-between bg-slate-950/95 backdrop-blur-xl border-t border-white/10 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M4 18l8-12 8 12M4 18h16" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                {productDef?.name ?? 'Product'}
              </h3>
              <button
                type="button"
                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer font-medium ${
                  notesValue.trim()
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
                onClick={() => setShowNotesModal((prev) => !prev)}
                title="Add PMS Pantone colors or special printing instructions"
              >
                {notesValue.trim() ? '📝 Notes Added' : '+ Instructions'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 max-w-[320px] truncate">{optionSummary}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Interactive Volume Quantity Stepper */}
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden h-9" aria-label="Select item quantity">
            <button
              type="button"
              className="w-8 h-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-sm"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || isAdding}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-7 px-1 text-center font-mono font-bold text-xs text-white tabular-nums" title={`Order quantity: ${quantity}`} aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="w-8 h-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-sm"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= 99 || isAdding}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <span className="font-mono text-xl font-bold text-amber-400 tracking-tight tabular-nums">
            {currentQuote
              ? formatCentsAsDisplay(currentQuote.totalCents, currentQuote.currency)
              : '—'}
          </span>

          <button
            className={`h-10 px-7 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-150 cursor-pointer shadow-lg flex items-center justify-center ${
              cartSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20 hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
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
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 flex items-center justify-center text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
            onClick={() => setShowCartInspector((prev) => !prev)}
            title="Show Shopify Payload Inspector"
          >
            { }
          </button>
        </div>
      </div>

      {cartError && (
        <div className="px-6 py-2 bg-rose-500/10 border-t border-rose-500/30 text-xs text-rose-400 text-center" role="alert">
          {cartError}
        </div>
      )}

      {/* Design Notes & Printing Instructions Modal */}
      {showNotesModal && (
        <div className="fixed bottom-[80px] left-6 w-96 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>🎨</span> Custom Printing Instructions / PMS Codes
            </h4>
            <button
              type="button"
              className="text-slate-400 hover:text-white text-lg leading-none cursor-pointer p-1"
              onClick={() => setShowNotesModal(false)}
            >
              ×
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Provide PMS / Pantone color match codes or placement notes for our pre-press team.
          </p>
          <textarea
            className="w-full bg-slate-950 border border-white/10 rounded-lg text-slate-200 text-xs p-2.5 resize-y outline-none focus:border-amber-400 transition-colors"
            placeholder="e.g. Roof: PMS 286 Blue, Valance: PMS 186 Red. Center logo 3 inches above valance seam."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
            <span className="text-[10px] text-slate-500 font-mono">{notesValue.length}/500</span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
              onClick={() => setShowNotesModal(false)}
            >
              Save Instructions
            </button>
          </div>
        </div>
      )}

      {/* Shopify Payload Inspector — shows exactly what would be sent */}
      {showCartInspector && activePayload && (
        <div className="fixed bottom-[80px] right-6 w-[440px] max-h-[460px] bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between p-3.5 border-b border-white/10">
            <h4 className="text-xs font-bold text-white tracking-wide font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Shopify Cart Payload Inspector
            </h4>
            <button
              onClick={() => setShowCartInspector(false)}
              className="text-slate-400 hover:text-white text-lg leading-none cursor-pointer p-1"
            >
              ×
            </button>
          </div>
          <pre className="p-3.5 text-[11px] font-mono text-emerald-300 bg-slate-950 overflow-y-auto max-h-[300px] leading-relaxed">
            {JSON.stringify(activePayload, null, 2)}
          </pre>
          <p className="p-3 text-[10px] text-slate-400 bg-slate-900/90 border-t border-white/10 leading-normal">
            This is the exact payload sent to Shopify&apos;s{' '}
            <code className="text-amber-300 bg-white/5 px-1 py-0.5 rounded">/cart/add.js</code> API. Properties prefixed with underscore
            are hidden from the customer at checkout.
          </p>
        </div>
      )}
    </>
  );
}
