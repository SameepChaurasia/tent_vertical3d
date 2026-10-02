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
export function DesignControls() {
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
    <div className="p-4 space-y-4 text-slate-100 outline-none focus:outline-none" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-800">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          onClick={handleAddText}
          title="Add Text"
        >
          <span className="text-sm font-bold leading-none">T</span>
          <span>Add Text</span>
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Image"
        >
          <span className="text-sm leading-none">📷</span>
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

        <div className="h-5 w-[1px] bg-slate-700 mx-1" />

        <button
          className="w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {uploadError && (
        <div className="p-2.5 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-lg flex items-center gap-2" role="alert">
          <span>⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}

      {/* Consolidated Fabric Color & Presets card */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-200 uppercase">
            <span>🎨</span>
            <span>Fabric Color & Presets</span>
          </h4>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 font-semibold">{sectionConfig?.baseColor ?? '#F5A623'}</span>
            <input
              type="color"
              value={sectionConfig?.baseColor ?? '#F5A623'}
              onChange={(e) => setSectionBaseColor(sectionId, e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border border-slate-600 bg-transparent"
              title="Custom Hex Picker"
            />
          </div>
        </div>

        {/* Compact color swatches row */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {colorSwatches.slice(0, 9).map((color) => {
            const isSelected = sectionConfig?.baseColor?.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                className={`w-6 h-6 rounded-md border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 border-white scale-110 shadow-md'
                    : 'border-slate-700/80 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSectionBaseColor(sectionId, color)}
                aria-label={`Set base color to ${color}`}
              />
            );
          })}
        </div>

        {/* 1-Click Brand Presets in same card */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Style:</span>
          <div className="flex gap-1.5 flex-1">
            <button
              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-all cursor-pointer truncate text-center"
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
              title="Sleek midnight blue AI showcase with cyan accents"
            >
              ⚡ Apex
            </button>
            <button
              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-all cursor-pointer truncate text-center"
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
              title="Energetic orange festival booth with bold lettering"
            >
              🔥 Fest
            </button>
            <button
              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded-md bg-slate-800 border border-slate-700 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-all cursor-pointer truncate text-center"
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
              title="Matte black motorsport setup with racing red text"
            >
              🏁 Race
            </button>
          </div>
        </div>
      </div>

      {/* Selected layer properties */}
      {selectedLayer && (
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-3.5 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
              <span>🎛️</span>
              <span>{selectedLayer.kind === 'text' ? 'Text Layer Settings' : 'Image Layer Settings'}</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              ID: {selectedLayer.id.slice(0, 6)}
            </span>
          </div>

          {selectedLayer.kind === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="text-content" className="text-xs text-slate-300 font-medium w-14 shrink-0">Text:</label>
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
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-font" className="text-xs text-slate-300 font-medium w-14 shrink-0">Font:</label>
                <select
                  id="text-font"
                  value={selectedLayer.fontFamily}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      fontFamily: e.target.value as typeof selectedLayer.fontFamily,
                    })
                  }
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                >
                  {ALLOWED_FONT_FAMILIES.map((font) => (
                    <option key={font} value={font} className="bg-slate-900 text-white">
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-size" className="text-xs text-slate-300 font-medium w-14 shrink-0">Size:</label>
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
                  className="w-20 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <span className="text-[11px] text-slate-400">pt</span>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="text-color" className="text-xs text-slate-300 font-medium w-14 shrink-0">Color:</label>
                <div className="flex items-center gap-2">
                  <input
                    id="text-color"
                    type="color"
                    value={selectedLayer.fill}
                    onChange={(e) =>
                      updateLayer(sectionId, selectedLayer.id, { fill: e.target.value })
                    }
                    className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-300">{selectedLayer.fill.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium w-14 shrink-0">Align:</span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-700 rounded-lg">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
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
                <label htmlFor="text-opacity" className="text-xs text-slate-300 font-medium w-14 shrink-0">Opacity:</label>
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
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right">
                  {Math.round(selectedLayer.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          {selectedLayer.kind === 'image' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="image-opacity" className="text-xs text-slate-300 font-medium w-14 shrink-0">Opacity:</label>
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
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right">
                  {Math.round(selectedLayer.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-center"
              onClick={handleDeleteSelected}
            >
              🗑️ Delete Layer
            </button>
            <button
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer text-center"
              onClick={handleDuplicateSelected}
            >
              📋 Duplicate
            </button>
          </div>
        </div>
      )}

      {/* Layer list card */}
      {sectionConfig && sectionConfig.layers.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              <span>📑</span>
              <span>Active Artwork Layers</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">{sectionConfig.layers.length} items</span>
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
