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

  const [studioTab, setStudioTab] = useState<'editor' | 'options'>('editor');
  const [viewMode, setViewMode] = useState<'studio' | 'split'>('studio');

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans ${isEmbed ? 'embed-mode' : ''}`}>
      {/* Header — hidden in embed mode */}
      {!isEmbed && (
        <header className="h-14 px-6 bg-slate-950/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18M4 18l8-12 8 12M4 18h16" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-extrabold tracking-wider text-white uppercase leading-tight">
                10×10 CUSTOM CANOPY TENT
              </h1>
              <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                COMMERCIAL 3D STUDIO • PRO SERIES
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
              LIVE 3D ENGINE
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop View Mode Switcher */}
            <div className="hidden lg:flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setViewMode('studio')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'studio'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Spacious luxury studio mode with dedicated tabs"
              >
                <span>🔲</span>
                <span>Studio View</span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'split'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Pro 3-column split view for wide screens"
              >
                <span>◫</span>
                <span>3-Column Pro</span>
              </button>
            </div>

            <button
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating || !currentQuote}
              title="Download production PDF"
            >
              {isPdfGenerating ? '⏳ Generating…' : '📄 Export Spec Sheet'}
            </button>
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-white/5 border border-white/10 rounded-full">
              ⚡ 2-Day Production
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-white/5 border border-white/10 rounded-full">
              🛡️ Commercial Grade
            </span>
          </div>
        </header>
      )}

      {/* Mobile tab bar */}
      <nav className="lg:hidden flex bg-slate-900 border-b border-white/10 px-2 shrink-0">
        <button
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === '3d'
              ? 'text-amber-400 border-amber-400 bg-amber-500/5'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
          onClick={() => setActiveTab('3d')}
        >
          3D Preview
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === '2d'
              ? 'text-amber-400 border-amber-400 bg-amber-500/5'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
          onClick={() => setActiveTab('2d')}
        >
          2D Editor
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === 'options'
              ? 'text-amber-400 border-amber-400 bg-amber-500/5'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
          onClick={() => setActiveTab('options')}
        >
          Options & Quote
        </button>
      </nav>

      {/* Main content */}
      <main
        className={`grid grid-cols-1 flex-1 overflow-hidden ${
          viewMode === 'studio'
            ? 'lg:grid-cols-[1fr_560px] xl:grid-cols-[1fr_620px] 2xl:grid-cols-[1fr_680px]'
            : 'lg:grid-cols-[1fr_420px_380px] xl:grid-cols-[1fr_440px_400px]'
        }`}
      >
        {/* 3D Viewer */}
        <section
          className={`relative bg-gradient-to-b from-[#161a24] to-[#0c0e14] overflow-hidden ${
            activeTab !== '3d' ? 'hidden lg:block' : 'block'
          }`}
        >
          <ConfiguratorCanvas ref={viewerRef} />
        </section>

        {/* Studio Mode Workspace (When viewMode === 'studio') */}
        {viewMode === 'studio' ? (
          <aside className="hidden lg:flex flex-col bg-slate-950/95 border-l border-slate-800 overflow-hidden relative">
            {/* Studio Workspace Header Tabs */}
            <div className="shrink-0 p-4 pb-3 bg-slate-950 border-b border-slate-800/80">
              <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStudioTab('editor')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    studioTab === 'editor'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <span className="text-sm">🎨</span>
                  <span>2D Graphic Design Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('options')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    studioTab === 'options'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <span className="text-sm">⚙️</span>
                  <span>Product Options & Quote</span>
                </button>
              </div>
            </div>

            {/* Studio Tab 1: 2D Editor */}
            <div
              className={`flex-1 overflow-y-auto p-5 pb-32 space-y-5 ${
                studioTab === 'editor' ? 'block' : 'hidden'
              }`}
            >
              <DesignControls>
                <DesignEditor />
              </DesignControls>
            </div>

            {/* Studio Tab 2: Options + Pricing */}
            <div
              className={`flex-1 overflow-y-auto p-5 pb-32 space-y-5 ${
                studioTab === 'options' ? 'block' : 'hidden'
              }`}
            >
              <OptionsPanel />
              <PricingPanel
                pricingService={pricingService}
                onQuoteReady={handleQuoteReady}
              />
            </div>
          </aside>
        ) : (
          /* Split 3-Column Mode Workspace (When viewMode === 'split') */
          <>
            {/* 2D Editor + Controls */}
            <section
              className={`flex flex-col bg-slate-900/60 border-t lg:border-t-0 lg:border-l lg:border-r border-slate-800 overflow-y-auto p-4 pb-28 space-y-4 ${
                activeTab !== '2d' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <DesignControls>
                <DesignEditor />
              </DesignControls>
            </section>

            {/* Options + Pricing */}
            <aside
              className={`bg-slate-950/90 p-4 pb-28 overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col gap-4 ${
                activeTab !== 'options' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <OptionsPanel />
              <PricingPanel
                pricingService={pricingService}
                onQuoteReady={handleQuoteReady}
              />
            </aside>
          </>
        )}
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
