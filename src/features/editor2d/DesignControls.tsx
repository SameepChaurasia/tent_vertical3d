import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  useConfiguratorStore,
  selectActiveSectionId,
  selectSectionConfig,
  selectSelectedLayerId,
  selectCanUndo,
  selectCanRedo,
  selectProductDefinition,
} from '../configurator/configurator.store';
import type { AssetEntry } from '../../domain/schemas';
import { ALLOWED_FONT_FAMILIES } from '../../domain/schemas/configuration.schema';

/** Validate uploaded image by magic bytes, not just extension */
function validateImageMagicBytes(buffer: ArrayBuffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const bytes = new Uint8Array(buffer.slice(0, 12));

  /* PNG: 89 50 4E 47 */
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  /* JPEG: FF D8 FF */
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  /* WebP: 52 49 46 46 ... 57 45 42 50 */
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 4096;

/**
 * Design controls toolbar — text, image upload, colour picker, layer management.
 */
export function DesignControls({ children }: { children?: React.ReactNode } = {}) {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const activeSectionId = useConfiguratorStore(selectActiveSectionId);
  const sectionConfig = useConfiguratorStore(
    selectSectionConfig(activeSectionId ?? 'canopy'),
  );
  const selectedLayerId = useConfiguratorStore(selectSelectedLayerId);
  const canUndo = useConfiguratorStore(selectCanUndo);
  const canRedo = useConfiguratorStore(selectCanRedo);

  const addTextLayer = useConfiguratorStore((s) => s.addTextLayer);
  const addImageLayer = useConfiguratorStore((s) => s.addImageLayer);
  const setSectionBaseColor = useConfiguratorStore((s) => s.setSectionBaseColor);
  const removeLayer = useConfiguratorStore((s) => s.removeLayer);
  const duplicateLayer = useConfiguratorStore((s) => s.duplicateLayer);
  const updateLayer = useConfiguratorStore((s) => s.updateLayer);
  const registerAsset = useConfiguratorStore((s) => s.registerAsset);
  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const selectLayer = useConfiguratorStore((s) => s.selectLayer);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sectionId = activeSectionId ?? 'canopy';
  const activeSection = productDef?.sections.find((s) => s.id === sectionId);
  const defaultRegionId = activeSection?.printRegions[0]?.id ?? 'roof-front';

  const handleAddText = useCallback(() => {
    const layerId = addTextLayer(sectionId, defaultRegionId);
    selectLayer(layerId);
  }, [sectionId, defaultRegionId, addTextLayer, selectLayer]);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);

      /* Size check */
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(`File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`);
        return;
      }

      /* Magic byte validation */
      const buffer = await file.arrayBuffer();
      const mimeType = validateImageMagicBytes(buffer);

      if (!mimeType) {
        setUploadError('Invalid file type. Please upload PNG, JPEG, or WebP images only.');
        return;
      }

      /* Load image to check dimensions */
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        /* Downscale if too large */
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const assetId = uuidv4();
        const asset: AssetEntry = {
          id: assetId,
          fileName: file.name,
          mimeType,
          pixelWidth: width,
          pixelHeight: height,
          byteSize: file.size,
          objectUrl,
        };

        registerAsset(asset);
        const layerId = addImageLayer(sectionId, defaultRegionId, assetId);
        selectLayer(layerId);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setUploadError('Failed to load image. Please try a different file.');
      };

      img.src = objectUrl;

      /* Reset input so the same file can be re-uploaded */
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [sectionId, defaultRegionId, registerAsset, addImageLayer, selectLayer],
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedLayerId) {
      removeLayer(sectionId, selectedLayerId);
    }
  }, [sectionId, selectedLayerId, removeLayer]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedLayerId) {
      const newId = duplicateLayer(sectionId, selectedLayerId);
      if (newId) selectLayer(newId);
    }
  }, [sectionId, selectedLayerId, duplicateLayer, selectLayer]);

  /* Keyboard shortcuts */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId && !(e.target instanceof HTMLInputElement)) {
          handleDeleteSelected();
        }
      }
    },
    [undo, redo, selectedLayerId, handleDeleteSelected],
  );

  const selectedLayer = sectionConfig?.layers.find((l) => l.id === selectedLayerId);

  /* Brand-friendly colour swatches */
  const colorSwatches = [
    '#F5A623', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
    '#1ABC9C', '#F39C12', '#E67E22', '#2C3E50', '#FFFFFF',
    '#000000', '#95A5A6',
  ];

  return (
    <div className="space-y-6 text-slate-100 outline-none focus:outline-none" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Primary Action Toolbar Card */}
      <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
            onClick={handleAddText}
            title="Add New Text Layer to Canvas"
          >
            <span className="text-base font-extrabold leading-none">+</span>
            <span>Add Text</span>
          </button>

          <button
            className="flex items-center gap-2.5 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#1b2131] text-slate-200 border border-white/[0.08] hover:bg-[#232c40] hover:border-white/[0.15] shadow-md transition-all cursor-pointer active:scale-95"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Artwork or Logo (PNG, JPEG, WebP up to 10MB)"
          >
            <span className="text-base leading-none">📷</span>
            <span>Upload Image</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageUpload}
            className="sr-only"
            aria-label="Upload artwork image"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl bg-[#1b2131] border border-white/[0.08] text-slate-300 hover:bg-[#232c40] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl bg-[#1b2131] border border-white/[0.08] text-slate-300 hover:bg-[#232c40] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 shadow-lg" role="alert">
          <span className="text-base">⚠️</span>
          <span className="font-medium">{uploadError}</span>
        </div>
      )}

      {/* Embedded Artboard Canvas */}
      {children}

      {/* Base Fabric Color Section */}
      <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              <span>🎨</span>
              <span>Base Fabric Color</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">Select from commercial fabric finishes or pick a custom hex</p>
          </div>
          <div className="flex items-center gap-2.5 bg-[#0a0d14] px-3.5 py-1.5 rounded-xl border border-white/[0.08] shadow-inner">
            <input
              type="color"
              value={sectionConfig?.baseColor ?? '#F5A623'}
              onChange={(e) => setSectionBaseColor(sectionId, e.target.value)}
              className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
              title="Custom Hex Picker"
            />
            <span className="text-xs font-mono font-bold text-amber-400">
              {sectionConfig?.baseColor ?? '#F5A623'}
            </span>
          </div>
        </div>

        {/* Spacious 6-column swatches */}
        <div className="grid grid-cols-6 gap-3 pt-1">
          {colorSwatches.map((color) => {
            const isSelected = sectionConfig?.baseColor?.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                className={`h-11 rounded-xl border transition-all cursor-pointer flex items-center justify-center relative ${
                  isSelected
                    ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#121622] border-white scale-105 shadow-lg shadow-amber-500/25'
                    : 'border-white/[0.08] hover:border-white/30 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSectionBaseColor(sectionId, color)}
                aria-label={`Set base color to ${color}`}
              >
                {isSelected && (
                  <span className="text-white text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Style Presets Section */}
      <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              <span>⚡</span>
              <span>Curated Brand Presets</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">1-click ready-to-print commercial colorways</p>
          </div>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
            Instant Theme
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <button
            className="p-4 rounded-xl bg-[#0a0d14] border border-white/[0.06] hover:border-cyan-500/50 hover:bg-[#111726] transition-all text-left cursor-pointer group shadow-sm flex flex-col justify-between min-h-[96px]"
            onClick={() => {
              setSectionBaseColor('canopy', '#0F172A');
              setSectionBaseColor('frame', '#334155');
              const layerId = addTextLayer('canopy', 'roof-front', {
                content: 'APEX AI',
                fontFamily: 'Montserrat',
                fontSizePt: 54,
                fill: '#00E5FF',
                align: 'center',
              });
              selectLayer(layerId);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-[#0F172A] border border-cyan-400/50 shadow-sm" />
              <span className="w-4 h-4 rounded-full bg-[#00E5FF] shadow-sm" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">Apex Tech</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Midnight & Cyan</div>
            </div>
          </button>

          <button
            className="p-4 rounded-xl bg-[#0a0d14] border border-white/[0.06] hover:border-amber-500/50 hover:bg-[#111726] transition-all text-left cursor-pointer group shadow-sm flex flex-col justify-between min-h-[96px]"
            onClick={() => {
              setSectionBaseColor('canopy', '#EA580C');
              setSectionBaseColor('frame', '#E2E8F0');
              const layerId = addTextLayer('canopy', 'roof-front', {
                content: 'SUMMER FEST',
                fontFamily: 'Bebas Neue',
                fontSizePt: 64,
                fill: '#FFFFFF',
                align: 'center',
              });
              selectLayer(layerId);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-[#EA580C] border border-amber-400/50 shadow-sm" />
              <span className="w-4 h-4 rounded-full bg-[#FFFFFF] shadow-sm" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300">Summer Fest</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Warm Coral & White</div>
            </div>
          </button>

          <button
            className="p-4 rounded-xl bg-[#0a0d14] border border-white/[0.06] hover:border-rose-500/50 hover:bg-[#111726] transition-all text-left cursor-pointer group shadow-sm flex flex-col justify-between min-h-[96px]"
            onClick={() => {
              setSectionBaseColor('canopy', '#18181B');
              setSectionBaseColor('frame', '#DC2626');
              const layerId = addTextLayer('canopy', 'roof-front', {
                content: 'VELOCITY GT',
                fontFamily: 'Oswald',
                fontSizePt: 58,
                fill: '#DC2626',
                align: 'center',
              });
              selectLayer(layerId);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-[#18181B] border border-rose-400/50 shadow-sm" />
              <span className="w-4 h-4 rounded-full bg-[#DC2626] shadow-sm" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300">Velocity GT</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Stealth & Racing Red</div>
            </div>
          </button>
        </div>
      </div>

      {/* Selected layer properties */}
      {selectedLayer && (
        <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <span>🎛️</span>
                <span>{selectedLayer.kind === 'text' ? 'Text Layer Settings' : 'Image Layer Settings'}</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">Adjust typography, scaling, and layer styling</p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-[#0a0d14] px-2.5 py-1 rounded-lg border border-white/[0.08]">
              ID: {selectedLayer.id.slice(0, 6)}
            </span>
          </div>

          {selectedLayer.kind === 'text' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label htmlFor="text-content" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Text:</label>
                <input
                  id="text-content"
                  type="text"
                  value={selectedLayer.content}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      content: e.target.value.slice(0, 200),
                    })
                  }
                  maxLength={200}
                  className="flex-1 px-4 py-2.5 text-xs bg-[#0a0d14] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-amber-400 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-font" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Font:</label>
                <select
                  id="text-font"
                  value={selectedLayer.fontFamily}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      fontFamily: e.target.value as typeof selectedLayer.fontFamily,
                    })
                  }
                  className="flex-1 px-4 py-2.5 text-xs bg-[#0a0d14] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-amber-400 shadow-inner cursor-pointer"
                >
                  {ALLOWED_FONT_FAMILIES.map((font) => (
                    <option key={font} value={font} className="bg-slate-900 text-white">
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-size" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Size:</label>
                <div className="flex items-center gap-2">
                  <input
                    id="text-size"
                    type="number"
                    value={selectedLayer.fontSizePt}
                    onChange={(e) =>
                      updateLayer(sectionId, selectedLayer.id, {
                        fontSizePt: Math.max(8, Math.min(200, Number(e.target.value))),
                      })
                    }
                    min={8}
                    max={200}
                    className="w-24 px-3 py-2 text-xs bg-[#0a0d14] border border-white/[0.1] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                  <span className="text-xs text-slate-400">pt</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-color" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Color:</label>
                <div className="flex items-center gap-3 bg-[#0a0d14] px-3.5 py-1.5 rounded-xl border border-white/[0.1]">
                  <input
                    id="text-color"
                    type="color"
                    value={selectedLayer.fill}
                    onChange={(e) =>
                      updateLayer(sectionId, selectedLayer.id, { fill: e.target.value })
                    }
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono font-bold text-slate-300">{selectedLayer.fill.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-semibold w-16 shrink-0">Align:</span>
                <div className="flex items-center gap-1.5 bg-[#0a0d14] p-1.5 border border-white/[0.1] rounded-xl">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                        selectedLayer.align === align
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() =>
                        updateLayer(sectionId, selectedLayer.id, { align })
                      }
                      title={`Align ${align}`}
                    >
                      {align === 'left' ? '⫷' : align === 'center' ? '⫸⫷' : '⫸'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-opacity" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Opacity:</label>
                <input
                  id="text-opacity"
                  type="range"
                  min="10"
                  max="100"
                  value={Math.round(selectedLayer.opacity * 100)}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      opacity: Number(e.target.value) / 100,
                    })
                  }
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right font-semibold">
                  {Math.round(selectedLayer.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          {selectedLayer.kind === 'image' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label htmlFor="image-opacity" className="text-xs text-slate-300 font-semibold w-16 shrink-0">Opacity:</label>
                <input
                  id="image-opacity"
                  type="range"
                  min="10"
                  max="100"
                  value={Math.round(selectedLayer.opacity * 100)}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      opacity: Number(e.target.value) / 100,
                    })
                  }
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right font-semibold">
                  {Math.round(selectedLayer.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
            <button
              className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-center active:scale-95 shadow-sm"
              onClick={handleDeleteSelected}
            >
              🗑️ Delete Layer
            </button>
            <button
              className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-[#1b2131] text-slate-200 border border-white/[0.08] hover:bg-[#232c40] hover:text-white transition-all cursor-pointer text-center active:scale-95 shadow-sm"
              onClick={handleDuplicateSelected}
            >
              📋 Duplicate
            </button>
          </div>
        </div>
      )}

      {/* Layer list card */}
      {sectionConfig && sectionConfig.layers.length > 0 && (
        <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
                <span>📑</span>
                <span>Active Artwork Layers</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Click a layer to transform or adjust properties</p>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              {sectionConfig.layers.length} {sectionConfig.layers.length === 1 ? 'layer' : 'layers'}
            </span>
          </div>
          <ul className="space-y-1.5">
            {[...sectionConfig.layers].reverse().map((layer) => {
              const isSelected = selectedLayerId === layer.id;
              return (
                <li
                  key={layer.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                  onClick={() => selectLayer(layer.id)}
                >
                  <span className="w-5 text-center text-sm font-bold opacity-90">
                    {layer.kind === 'text' ? 'T' : '🖼'}
                  </span>
                  <span className="flex-1 text-xs font-medium truncate">
                    {layer.kind === 'text'
                      ? layer.content.slice(0, 24) || 'Empty Text'
                      : 'Artwork Image'}
                  </span>
                  <button
                    className="p-1 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer text-slate-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(sectionId, layer.id, { visible: !layer.visible });
                    }}
                    aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? '👁' : '👁‍🗨'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
