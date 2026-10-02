import { useEffect, useRef, useState, useCallback } from 'react';
import { ConfiguratorCanvas } from '../features/viewer3d/ConfiguratorCanvas';
import { OptionsPanel } from '../features/options/OptionsPanel';
import { PricingPanel } from '../features/pricing/PricingPanel';
import { DesignEditor } from '../features/editor2d/DesignEditor';
import { DesignControls } from '../features/editor2d/DesignControls';
import { CheckoutBar } from '../features/checkout/CheckoutBar';
import { useConfiguratorStore, selectConfiguration, selectProductDefinition } from '../features/configurator/configurator.store';
import { useEmbedMode } from '../features/embed/useEmbedMode';
import { CANOPY_TENT_PRODUCT } from '../domain/products/canopy-tent.product';
import { MockPricingService } from '../services/mock/mock-pricing.service';
import { MockCartService } from '../services/mock/mock-cart.service';
import { generateProductionPdf } from '../services/pdf/pdf-generator';
import type { PriceQuote } from '../domain/schemas';
import type { ViewerHandle } from '../features/viewer3d/ConfiguratorCanvas';

/* Services — instantiated once at module level */
const pricingService = new MockPricingService();
const cartService = new MockCartService();

type ActiveTab = '3d' | '2d' | 'options';

/**
 * Root application component — the configurator composition root.
 *
 * LAYOUT:
 * - Desktop: 3D viewer (left) + 2D editor (center) + options panel (right)
 * - Mobile: Tab bar switching between 3D / 2D / Options views
 *
 * IMPORTANT: Both the 3D viewer and 2D editor stay mounted at all times
 * (hidden via CSS on mobile) to maintain texture sync. Unmounting the
 * editor would break the canvas texture pipeline.
 */
export function App() {
  const initializeProduct = useConfiguratorStore((s) => s.initializeProduct);
  const configuration = useConfiguratorStore(selectConfiguration);
  const productDef = useConfiguratorStore(selectProductDefinition);
  const viewerRef = useRef<ViewerHandle>(null);
  const [currentQuote, setCurrentQuote] = useState<PriceQuote | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('3d');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [designNotes, setDesignNotes] = useState('');

  /* Embed mode — sends postMessage events when running in iframe */
  const { isEmbed } = useEmbedMode();

  /* Initialize with the canopy tent product */
  useEffect(() => {
    initializeProduct(CANOPY_TENT_PRODUCT);
  }, [initializeProduct]);

  const handleQuoteReady = useCallback((quote: PriceQuote) => {
    setCurrentQuote(quote);
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!configuration || !productDef || !currentQuote) return;

    setIsPdfGenerating(true);
    try {
      /* Capture 3D snapshot from the canvas */
      let previewSnapshot: string | undefined;
      const canvas3d = document.querySelector('.viewer-3d-container canvas') as HTMLCanvasElement | null;
      if (canvas3d) {
        previewSnapshot = canvas3d.toDataURL('image/png');
      }

      /* Capture 2D artwork from the Konva stage */
      let artworkSnapshot: string | undefined;
      const konvaCanvas = document.querySelector('.editor-2d-canvas-wrapper canvas') as HTMLCanvasElement | null;
      if (konvaCanvas) {
        artworkSnapshot = konvaCanvas.toDataURL('image/png');
      }

      await generateProductionPdf({
        configuration,
        productDefinition: productDef,
        quote: currentQuote,
        designNotes,
        previewSnapshot,
        artworkSnapshot,
      });
    } finally {
      setIsPdfGenerating(false);
    }
  }, [configuration, productDef, currentQuote, designNotes]);

  return (
    <div className={`configurator-app ${isEmbed ? 'embed-mode' : ''}`}>
      {/* Header — hidden in embed mode */}
      {!isEmbed && (
        <header className="configurator-header">
          <div className="header-brand">
            <div className="header-logo-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18M4 18l8-12 8 12M4 18h16" />
              </svg>
            </div>
            <div className="header-brand-text">
              <h1>10×10 CUSTOM CANOPY TENT</h1>
              <span className="header-brand-sub">COMMERCIAL 3D STUDIO • PRO SERIES</span>
            </div>
            <span className="live-indicator">
              <span className="live-dot" /> LIVE 3D ENGINE
            </span>
          </div>
          <div className="header-meta">
            <button
              className="header-pdf-button"
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating || !currentQuote}
              title="Download production PDF"
            >
              {isPdfGenerating ? '⏳ Generating…' : '📄 Export Spec Sheet'}
            </button>
            <span className="header-badge">⚡ 2-Day Production</span>
            <span className="header-badge">🛡️ Commercial Grade</span>
          </div>
        </header>
      )}

      {/* Mobile tab bar */}
      <nav className="mobile-tab-bar">
        <button
          className={`mobile-tab ${activeTab === '3d' ? 'mobile-tab-active' : ''}`}
          onClick={() => setActiveTab('3d')}
        >
          3D Preview
        </button>
        <button
          className={`mobile-tab ${activeTab === '2d' ? 'mobile-tab-active' : ''}`}
          onClick={() => setActiveTab('2d')}
        >
          2D Editor
        </button>
        <button
          className={`mobile-tab ${activeTab === 'options' ? 'mobile-tab-active' : ''}`}
          onClick={() => setActiveTab('options')}
        >
          Options
        </button>
      </nav>

      {/* Main content */}
      <main className="configurator-main">
        {/* 3D Viewer */}
        <section
          className={`configurator-viewer ${activeTab !== '3d' ? 'mobile-hidden' : ''}`}
        >
          <ConfiguratorCanvas ref={viewerRef} />
        </section>

        {/* 2D Editor + Controls */}
        <section
          className={`configurator-editor ${activeTab !== '2d' ? 'mobile-hidden' : ''}`}
        >
          <DesignControls />
          <DesignEditor />
        </section>

        {/* Options + Pricing */}
        <aside
          className={`configurator-sidebar ${activeTab !== 'options' ? 'mobile-hidden' : ''}`}
        >
          <div className="sidebar-info">
            <div className="info-item">
              <span className="info-icon">⚡</span>
              <span><strong>Production:</strong> 2 Business Days</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🚚</span>
              <span><strong>Delivery:</strong> 5–7 Days Nationwide</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🏷️</span>
              <span><strong>Wholesale:</strong> Volume Tier Pricing</span>
            </div>
            <div className="info-item">
              <span className="info-icon">✨</span>
              <span><strong>No Minimums:</strong> Free Digital Proofs</span>
            </div>
          </div>

          <OptionsPanel />
          <PricingPanel
            pricingService={pricingService}
            onQuoteReady={handleQuoteReady}
          />
        </aside>
      </main>

      {/* Checkout bar */}
      <CheckoutBar
        cartService={cartService}
        currentQuote={currentQuote}
        designNotes={designNotes}
        onDesignNotesChange={setDesignNotes}
      />
    </div>
  );
}
