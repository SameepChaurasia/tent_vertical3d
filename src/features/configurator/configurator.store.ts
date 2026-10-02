import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  Configuration,
  DesignLayer,
  TextLayer,
  ImageLayer,
  AssetEntry,
  ProductDefinition,
  SectionConfig,
  HexColor,
} from '../../domain/schemas';

/* ───── History entry for undo/redo ───── */

interface HistoryEntry {
  configuration: Configuration;
}

const MAX_HISTORY_SIZE = 30;

/* ───── Store state shape ───── */

export interface ConfiguratorState {
  /** The active product definition */
  productDefinition: ProductDefinition | null;

  /** The customer's current configuration — single source of truth */
  configuration: Configuration | null;

  /** Uploaded image assets (id → metadata + object URL) */
  assetRegistry: Map<string, AssetEntry>;

  /** Currently selected layer ID */
  selectedLayerId: string | null;

  /** Currently active section tab */
  activeSectionId: string | null;

  /** Undo/redo history */
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  /** Quantity for pricing */
  quantity: number;

  /* ── Actions ── */

  /** Initialize the store with a product definition */
  initializeProduct: (product: ProductDefinition) => void;

  /** Change a product option (e.g., wall type) */
  setOption: (groupId: string, choiceId: string) => void;

  /** Change the tent size */
  setSize: (sizeId: string) => void;

  /** Set base color for a section */
  setSectionBaseColor: (sectionId: string, color: HexColor) => void;

  /** Add a text layer to a section */
  addTextLayer: (sectionId: string, regionId: string, partial?: Partial<TextLayer>) => string;

  /** Add an image layer to a section */
  addImageLayer: (sectionId: string, regionId: string, assetId: string) => string;

  /** Update any layer's properties */
  updateLayer: (sectionId: string, layerId: string, updates: Partial<DesignLayer>) => void;

  /** Remove a layer */
  removeLayer: (sectionId: string, layerId: string) => void;

  /** Reorder layers within a section */
  reorderLayers: (sectionId: string, fromIndex: number, toIndex: number) => void;

  /** Duplicate a layer */
  duplicateLayer: (sectionId: string, layerId: string) => string | null;

  /** Select a layer */
  selectLayer: (layerId: string | null) => void;

  /** Set active section tab */
  setActiveSection: (sectionId: string) => void;

  /** Register an uploaded asset */
  registerAsset: (asset: AssetEntry) => void;

  /** Remove an asset and revoke its object URL */
  removeAsset: (assetId: string) => void;

  /** Undo last action */
  undo: () => void;

  /** Redo last undone action */
  redo: () => void;

  /** Set quantity */
  setQuantity: (quantity: number) => void;

  /** Export configuration as JSON-serializable object */
  exportConfiguration: () => Configuration | null;

  /** Import configuration from JSON */
  importConfiguration: (config: Configuration) => void;

  /** Reset to default configuration */
  resetConfiguration: () => void;
}

/* ───── Helpers ───── */

function createDefaultConfiguration(product: ProductDefinition): Configuration {
  const firstSizeId = Object.keys(product.models)[0];
  if (!firstSizeId) throw new Error('Product must have at least one model/size');

  const defaultOptions: Record<string, string> = {};
  for (const group of product.optionGroups) {
    const defaultChoice = group.choices.find((c) => c.isDefault) ?? group.choices[0];
    if (defaultChoice) {
      defaultOptions[group.id] = defaultChoice.id;
    }
  }

  const sections: Record<string, SectionConfig> = {};
  for (const section of product.sections) {
    sections[section.id] = {
      baseColor: '#F5A623',
      layers: [],
    };
  }

  return {
    schemaVersion: 1,
    configurationId: uuidv4(),
    productId: product.id,
    sizeId: firstSizeId,
    options: defaultOptions,
    sections,
  };
}

function pushToHistory(state: ConfiguratorState): void {
  if (!state.configuration) return;
  state.undoStack.push({
    configuration: JSON.parse(JSON.stringify(state.configuration)) as Configuration,
  });
  if (state.undoStack.length > MAX_HISTORY_SIZE) {
    state.undoStack.shift();
  }
  state.redoStack = [];
}

function getInitialRegionCoordinates(regionId: string): { x: number; y: number } {
  switch (regionId) {
    case 'roof-front':
      return { x: 0.5, y: 0.35 };
    case 'roof-back':
      return { x: 0.5, y: 0.65 };
    case 'roof-left':
      return { x: 0.15, y: 0.5 };
    case 'roof-right':
      return { x: 0.85, y: 0.5 };
    case 'valance-front':
      return { x: 0.5, y: 0.08 };
    case 'valance-back':
      return { x: 0.5, y: 0.92 };
    case 'valance-left':
      return { x: 0.08, y: 0.5 };
    case 'valance-right':
      return { x: 0.92, y: 0.5 };
    default:
      return { x: 0.5, y: 0.5 };
  }
}

/* ───── Store ───── */

export const useConfiguratorStore = create<ConfiguratorState>()(
  immer((set, get) => ({
    productDefinition: null,
    configuration: null,
    assetRegistry: new Map(),
    selectedLayerId: null,
    activeSectionId: null,
    undoStack: [],
    redoStack: [],
    quantity: 1,

    initializeProduct: (product) =>
      set((state) => {
        state.productDefinition = product;
        state.configuration = createDefaultConfiguration(product);
        state.activeSectionId = product.sections[0]?.id ?? null;
        state.undoStack = [];
        state.redoStack = [];
      }),

    setOption: (groupId, choiceId) =>
      set((state) => {
        if (!state.configuration) return;
        pushToHistory(state);
        state.configuration.options[groupId] = choiceId;
      }),

    setSize: (sizeId) =>
      set((state) => {
        if (!state.configuration) return;
        pushToHistory(state);
        state.configuration.sizeId = sizeId;
      }),

    setSectionBaseColor: (sectionId, color) =>
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        pushToHistory(state);
        section.baseColor = color;
      }),

    addTextLayer: (sectionId, regionId, partial) => {
      const layerId = uuidv4();
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        pushToHistory(state);

        const initialCoords = getInitialRegionCoordinates(regionId);
        const newLayer: TextLayer = {
          id: layerId,
          kind: 'text',
          regionId,
          normalizedX: initialCoords.x,
          normalizedY: initialCoords.y,
          rotationDegrees: 0,
          scale: 1,
          opacity: 1,
          zIndex: section.layers.length,
          visible: true,
          locked: false,
          content: partial?.content ?? 'Your Text',
          fontFamily: partial?.fontFamily ?? 'Arial',
          fontSizePt: partial?.fontSizePt ?? 48,
          fill: partial?.fill ?? '#FFFFFF',
          align: partial?.align ?? 'center',
        };

        section.layers.push(newLayer);
      });
      return layerId;
    },

    addImageLayer: (sectionId, regionId, assetId) => {
      const layerId = uuidv4();
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        pushToHistory(state);

        const initialCoords = getInitialRegionCoordinates(regionId);
        const newLayer: ImageLayer = {
          id: layerId,
          kind: 'image',
          regionId,
          normalizedX: initialCoords.x,
          normalizedY: initialCoords.y,
          rotationDegrees: 0,
          scale: 1,
          opacity: 1,
          zIndex: section.layers.length,
          visible: true,
          locked: false,
          assetId,
          fit: 'contain',
          normalizedWidth: 0.3,
          normalizedHeight: 0.3,
        };

        section.layers.push(newLayer);
      });
      return layerId;
    },

    updateLayer: (sectionId, layerId, updates) =>
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        const layerIndex = section.layers.findIndex((l) => l.id === layerId);
        if (layerIndex === -1) return;
        pushToHistory(state);

        const layer = section.layers[layerIndex];
        if (!layer) return;
        Object.assign(layer, updates);
      }),

    removeLayer: (sectionId, layerId) =>
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        pushToHistory(state);
        section.layers = section.layers.filter((l) => l.id !== layerId);
        if (state.selectedLayerId === layerId) {
          state.selectedLayerId = null;
        }
      }),

    reorderLayers: (sectionId, fromIndex, toIndex) =>
      set((state) => {
        const section = state.configuration?.sections[sectionId];
        if (!section) return;
        if (fromIndex < 0 || fromIndex >= section.layers.length) return;
        if (toIndex < 0 || toIndex >= section.layers.length) return;
        pushToHistory(state);

        const [moved] = section.layers.splice(fromIndex, 1);
        if (moved) {
          section.layers.splice(toIndex, 0, moved);
          section.layers.forEach((layer, i) => {
            layer.zIndex = i;
          });
        }
      }),

    duplicateLayer: (sectionId, layerId) => {
      const state = get();
      const section = state.configuration?.sections[sectionId];
      if (!section) return null;

      const sourceLayer = section.layers.find((l) => l.id === layerId);
      if (!sourceLayer) return null;

      const newId = uuidv4();
      set((draft) => {
        const draftSection = draft.configuration?.sections[sectionId];
        if (!draftSection) return;
        pushToHistory(draft);

        const duplicate = {
          ...JSON.parse(JSON.stringify(sourceLayer)) as DesignLayer,
          id: newId,
          normalizedX: Math.min((sourceLayer.normalizedX + 0.05), 1),
          normalizedY: Math.min((sourceLayer.normalizedY + 0.05), 1),
          zIndex: draftSection.layers.length,
        };

        draftSection.layers.push(duplicate);
      });

      return newId;
    },

    selectLayer: (layerId) =>
      set((state) => {
        state.selectedLayerId = layerId;
      }),

    setActiveSection: (sectionId) =>
      set((state) => {
        state.activeSectionId = sectionId;
        state.selectedLayerId = null;
      }),

    registerAsset: (asset) =>
      set((state) => {
        state.assetRegistry.set(asset.id, asset);
      }),

    removeAsset: (assetId) =>
      set((state) => {
        const asset = state.assetRegistry.get(assetId);
        if (asset) {
          URL.revokeObjectURL(asset.objectUrl);
          state.assetRegistry.delete(assetId);
        }
      }),

    undo: () =>
      set((state) => {
        const previous = state.undoStack.pop();
        if (!previous || !state.configuration) return;
        state.redoStack.push({
          configuration: JSON.parse(JSON.stringify(state.configuration)) as Configuration,
        });
        state.configuration = previous.configuration;
      }),

    redo: () =>
      set((state) => {
        const next = state.redoStack.pop();
        if (!next || !state.configuration) return;
        state.undoStack.push({
          configuration: JSON.parse(JSON.stringify(state.configuration)) as Configuration,
        });
        state.configuration = next.configuration;
      }),

    setQuantity: (quantity) =>
      set((state) => {
        state.quantity = Math.max(1, Math.round(quantity));
      }),

    exportConfiguration: () => {
      const state = get();
      if (!state.configuration) return null;
      return JSON.parse(JSON.stringify(state.configuration)) as Configuration;
    },

    importConfiguration: (config) =>
      set((state) => {
        state.configuration = config;
        state.undoStack = [];
        state.redoStack = [];
        state.selectedLayerId = null;
      }),

    resetConfiguration: () =>
      set((state) => {
        if (!state.productDefinition) return;
        pushToHistory(state);
        state.configuration = createDefaultConfiguration(state.productDefinition);
        state.selectedLayerId = null;
      }),
  })),
);

/* ───── Granular selectors to minimise re-renders ───── */

const EMPTY_OPTIONS: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_LAYERS: ReadonlyArray<DesignLayer> = Object.freeze([]);

export const selectConfiguration = (s: ConfiguratorState) => s.configuration;
export const selectProductDefinition = (s: ConfiguratorState) => s.productDefinition;
export const selectActiveSectionId = (s: ConfiguratorState) => s.activeSectionId;
export const selectSelectedLayerId = (s: ConfiguratorState) => s.selectedLayerId;
export const selectQuantity = (s: ConfiguratorState) => s.quantity;
export const selectCanUndo = (s: ConfiguratorState) => s.undoStack.length > 0;
export const selectCanRedo = (s: ConfiguratorState) => s.redoStack.length > 0;

export const selectCurrentOptions = (s: ConfiguratorState) =>
  s.configuration?.options ?? (EMPTY_OPTIONS as Record<string, string>);

export const selectCurrentSizeId = (s: ConfiguratorState) =>
  s.configuration?.sizeId ?? null;

export const selectSections = (s: ConfiguratorState) =>
  s.configuration?.sections;

export const selectSectionConfig = (sectionId: string) => (s: ConfiguratorState) =>
  s.configuration?.sections[sectionId] ?? null;

export const selectSectionLayers = (sectionId: string) => (s: ConfiguratorState) =>
  s.configuration?.sections[sectionId]?.layers ?? (EMPTY_LAYERS as DesignLayer[]);

export const selectAssetById = (assetId: string) => (s: ConfiguratorState) =>
  s.assetRegistry.get(assetId) ?? null;
