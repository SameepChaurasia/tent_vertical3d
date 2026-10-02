import {
  useConfiguratorStore,
  selectProductDefinition,
  selectCurrentOptions,
  selectCurrentSizeId,
} from '../configurator/configurator.store';

/**
 * Price deltas for option choices relative to base product ($849.00).
 * Matches the MVP Visuals reference product catalog.
 */
const OPTION_PRICE_TAGS: Record<string, string> = {
  'with-frame': '$849.00',
  'canopy-only': '-$300.00',
  'none': 'Included',
  'wall-1-single': '+$196.00',
  'wall-1-double': '+$316.00',
  'wall-3-single': '+$586.00',
  'wall-3-double': '+$946.00',
  'half-wall-single': '+$340.00',
  'half-wall-double': '+$436.00',
};

/**
 * Product options panel — renders pill-style selectors for each option group
 * and physical canopy dimensions (5x5, 6.5x6.5, 8x8 models).
 * Styled with high-contrast borders, solid cards, and price badges.
 */
export function OptionsPanel() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const currentSizeId = useConfiguratorStore(selectCurrentSizeId);
  const setOption = useConfiguratorStore((s) => s.setOption);
  const setSize = useConfiguratorStore((s) => s.setSize);

  if (!productDef) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Frame & Package (MVP Visuals Size Option) */}
      {productDef.optionGroups.map((group) => {
        /* Check visibility conditions */
        if (group.visibleWhen) {
          const isVisible = Object.entries(group.visibleWhen).every(
            ([depGroupId, allowedChoices]) => {
              const selectedChoice = currentOptions[depGroupId];
              return selectedChoice && allowedChoices.includes(selectedChoice);
            },
          );
          if (!isVisible) return null;
        }

        const selectedChoiceId = currentOptions[group.id];

        const sectionMeta: Record<string, { icon: string; subtitle: string }> = {
          'frame-type': { icon: '📦', subtitle: 'Hardware & Fabric Kit' },
          'side-walls': { icon: '🧱', subtitle: 'Full Enclosure Backdrop' },
          'half-walls': { icon: '🛡️', subtitle: 'Rail Mounted Banners (Set of 2)' },
        };

        const meta = sectionMeta[group.id] ?? { icon: '⚙️', subtitle: 'Option configuration' };

        return (
          <div key={group.id} className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
                <span>{meta.icon}</span>
                <span>{group.label}</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">{meta.subtitle}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                const priceTag = OPTION_PRICE_TAGS[choice.id];
                return (
                  <button
                    key={choice.id}
                    className={`flex items-center justify-between p-3 rounded-lg text-xs font-medium text-left border-2 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold shadow-md ring-1 ring-amber-400/30'
                        : 'bg-slate-900/90 border-slate-700/90 text-slate-200 hover:bg-slate-800 hover:border-slate-500'
                    }`}
                    onClick={() => setOption(group.id, choice.id)}
                    aria-pressed={isSelected}
                    aria-label={`${group.label}: ${choice.label}`}
                  >
                    <span className="pr-2">{choice.label}</span>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {priceTag && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            priceTag === 'Included'
                              ? 'text-slate-400 bg-white/5 border-white/10'
                              : priceTag.startsWith('-')
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          }`}
                        >
                          {priceTag}
                        </span>
                      )}
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'border-amber-400 bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'border-slate-500 bg-slate-800'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 2. Physical 3D CAD Model Scale (The 3 GLB files from assessment) */}
      {Object.keys(productDef.models).length > 1 && (
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              <span>📐</span>
              <span>3D CAD Model Dimensions</span>
            </h3>
            <span className="text-[10px] text-amber-400 font-mono font-semibold">Live Model Scale</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(productDef.models).map(([modelSizeId, modelData]) => {
              const isSelected = currentSizeId === modelSizeId;
              return (
                <button
                  key={modelSizeId}
                  className={`flex items-center justify-between p-3 rounded-lg text-xs font-medium text-left border-2 transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold shadow-md ring-1 ring-amber-400/30'
                      : 'bg-slate-900/90 border-slate-700/90 text-slate-200 hover:bg-slate-800 hover:border-slate-500'
                  }`}
                  onClick={() => setSize(modelSizeId)}
                  aria-pressed={isSelected}
                  aria-label={`Canopy Dimensions: ${modelData.label}`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-100">{modelData.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {modelData.physicalWidthInches}"W × {modelData.physicalDepthInches}"D × {modelData.physicalHeightInches}"H
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                      CAD Mesh
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-amber-400 bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'border-slate-500 bg-slate-800'
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
