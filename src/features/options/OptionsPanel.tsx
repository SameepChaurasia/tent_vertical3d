import { useState } from 'react';
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
 * Product options panel — renders sleek, collapsible accordions for each option group
 * and a compact 3-column segmented CAD dimensions selector.
 */
export function OptionsPanel() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const currentSizeId = useConfiguratorStore(selectCurrentSizeId);
  const setOption = useConfiguratorStore((s) => s.setOption);
  const setSize = useConfiguratorStore((s) => s.setSize);

  /* Accordion state: package and side-walls open by default, half-walls collapsed */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'frame-type': true,
    'side-walls': true,
    'half-walls': false,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!productDef) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Option Groups (Package, Side Walls, Half Walls) */}
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
        const selectedChoice = group.choices.find((c) => c.id === selectedChoiceId);
        const isOpen = openSections[group.id] ?? true;

        const sectionMeta: Record<string, { icon: string; subtitle: string }> = {
          'frame-type': { icon: '📦', subtitle: 'Kit & Hardware' },
          'side-walls': { icon: '🧱', subtitle: 'Full Back/Side Walls' },
          'half-walls': { icon: '🛡️', subtitle: 'Rail Banners' },
        };

        const meta = sectionMeta[group.id] ?? { icon: '⚙️', subtitle: 'Options' };

        return (
          <div key={group.id} className="bg-slate-900/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm transition-all">
            {/* Header Accordion Bar */}
            <button
              type="button"
              className="w-full flex items-center justify-between p-3 bg-slate-900/90 hover:bg-slate-800/80 transition-colors cursor-pointer text-left select-none"
              onClick={() => toggleSection(group.id)}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">{group.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {!isOpen && selectedChoice && (
                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded truncate max-w-[130px]">
                    {selectedChoice.label.split(':')[0]}
                  </span>
                )}
                <span className={`text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {/* Expandable Choices Body */}
            {isOpen && (
              <div className="p-3 pt-1 border-t border-slate-800/80 grid grid-cols-1 gap-1.5 animate-fadeIn">
                {group.choices.map((choice) => {
                  const isSelected = selectedChoiceId === choice.id;
                  const priceTag = OPTION_PRICE_TAGS[choice.id];
                  return (
                    <button
                      key={choice.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-left border transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold shadow-sm ring-1 ring-amber-400/25'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white'
                      }`}
                      onClick={() => setOption(group.id, choice.id)}
                      aria-pressed={isSelected}
                    >
                      <span className="pr-2 leading-snug">{choice.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {priceTag && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
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
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'border-amber-400 bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 3D CAD Model Dimensions — Sleek 3-column horizontal segmented tile row */}
      {Object.keys(productDef.models).length > 1 && (
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-200 uppercase">
              <span>📐</span>
              <span>3D Model Scale</span>
            </h3>
            <span className="text-[10px] text-amber-400 font-mono font-semibold">Live CAD</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(productDef.models).map(([modelSizeId, modelData]) => {
              const isSelected = currentSizeId === modelSizeId;
              const shortLabel = modelData.label.replace(' Canopy', '');
              return (
                <button
                  key={modelSizeId}
                  className={`py-2 px-1 text-center rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-bold shadow-sm ring-1 ring-amber-400/25'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-600 hover:text-white'
                  }`}
                  onClick={() => setSize(modelSizeId)}
                  aria-pressed={isSelected}
                  title={`${modelData.label} (${modelData.physicalWidthInches}"×${modelData.physicalDepthInches}")`}
                >
                  <span className="text-xs">{shortLabel}</span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {modelData.physicalWidthInches}"×{modelData.physicalDepthInches}"
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
