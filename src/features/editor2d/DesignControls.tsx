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
    <div className="design-controls" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="controls-toolbar">
        <button
          className="control-button control-button-primary"
          onClick={handleAddText}
          title="Add Text"
        >
          <span className="control-icon">T</span>
          <span className="control-label">Add Text</span>
        </button>

        <button
          className="control-button control-button-primary"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Image"
        >
          <span className="control-icon">📷</span>
          <span className="control-label">Upload Image</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageUpload}
          className="file-input-hidden"
          aria-label="Upload artwork image"
        />

        <div className="controls-separator" />

        <button
          className="control-button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="control-button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {uploadError && (
        <div className="upload-error" role="alert">
          {uploadError}
        </div>
      )}

      {/* Base colour picker */}
      <div className="controls-section">
        <h4 className="controls-section-title">Base Color</h4>
        <div className="color-swatches">
          {colorSwatches.map((color) => (
            <button
              key={color}
              className={`color-swatch ${
                sectionConfig?.baseColor === color ? 'color-swatch-selected' : ''
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setSectionBaseColor(sectionId, color)}
              aria-label={`Set base color to ${color}`}
            />
          ))}
        </div>
        <div className="color-hex-input">
          <label htmlFor="base-color-hex">Hex:</label>
          <input
            id="base-color-hex"
            type="text"
            value={sectionConfig?.baseColor ?? '#F5A623'}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value)) {
                setSectionBaseColor(sectionId, e.target.value);
              }
            }}
            maxLength={9}
            pattern="^#[0-9a-fA-F]{3,8}$"
          />
        </div>
      </div>

      {/* Selected layer properties */}
      {selectedLayer && (
        <div className="controls-section">
          <h4 className="controls-section-title">
            {selectedLayer.kind === 'text' ? 'Text Properties' : 'Image Properties'}
          </h4>

          {selectedLayer.kind === 'text' && (
            <div className="layer-properties">
              <div className="property-row">
                <label htmlFor="text-content">Text:</label>
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
                />
              </div>

              <div className="property-row">
                <label htmlFor="text-font">Font:</label>
                <select
                  id="text-font"
                  value={selectedLayer.fontFamily}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, {
                      fontFamily: e.target.value as typeof selectedLayer.fontFamily,
                    })
                  }
                >
                  {ALLOWED_FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="property-row">
                <label htmlFor="text-size">Size:</label>
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
                />
              </div>

              <div className="property-row">
                <label htmlFor="text-color">Color:</label>
                <input
                  id="text-color"
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) =>
                    updateLayer(sectionId, selectedLayer.id, { fill: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <div className="layer-actions">
            <button
              className="control-button control-button-danger"
              onClick={handleDeleteSelected}
            >
              Delete
            </button>
            <button
              className="control-button"
              onClick={handleDuplicateSelected}
            >
              Duplicate
            </button>
          </div>
        </div>
      )}

      {/* Layer list */}
      {sectionConfig && sectionConfig.layers.length > 0 && (
        <div className="controls-section">
          <h4 className="controls-section-title">Layers</h4>
          <ul className="layer-list">
            {[...sectionConfig.layers].reverse().map((layer) => (
              <li
                key={layer.id}
                className={`layer-list-item ${
                  selectedLayerId === layer.id ? 'layer-list-item-selected' : ''
                }`}
                onClick={() => selectLayer(layer.id)}
              >
                <span className="layer-icon">
                  {layer.kind === 'text' ? 'T' : '🖼'}
                </span>
                <span className="layer-name">
                  {layer.kind === 'text'
                    ? layer.content.slice(0, 20) || 'Empty Text'
                    : 'Image'}
                </span>
                <button
                  className="layer-visibility-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(sectionId, layer.id, { visible: !layer.visible });
                  }}
                  aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? '👁' : '👁‍🗨'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
