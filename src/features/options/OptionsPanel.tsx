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
    <div className="flex flex-col gap-6">
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
          'frame-type': { icon: '📦', subtitle: 'Choose between complete hardware kit or replacement canopy only' },
          'side-walls': { icon: '🧱', subtitle: 'Full enclosure wall backdrops for wind protection and branding' },
          'half-walls': { icon: '🛡️', subtitle: 'Rail-mounted lower booth banners for crowd guidance' },
        };

        const meta = sectionMeta[group.id] ?? { icon: '⚙️', subtitle: 'Select product specifications' };

        return (
          <div key={group.id} className="bg-[#121622] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl transition-all">
            {/* Header Accordion Bar */}
            <button
              type="button"
              className="w-full flex items-center justify-between p-5 bg-[#121622] hover:bg-[#171d2b] transition-colors cursor-pointer text-left select-none"
              onClick={() => toggleSection(group.id)}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#0a0d14] border border-white/[0.08] flex items-center justify-center text-lg shadow-inner">
                  {meta.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-white uppercase">{group.label}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-[320px] line-clamp-1">{meta.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!isOpen && selectedChoice && (
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full truncate max-w-[160px]">
                    {selectedChoice.label.split(':')[0]}
                  </span>
                )}
                <div className="w-7 h-7 rounded-lg bg-[#0a0d14] border border-white/[0.06] flex items-center justify-center text-slate-400 text-xs">
                  <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>
            </button>

            {/* Expandable Choices Body */}
            {isOpen && (
              <div
                className={`p-6 pt-4 border-t border-white/[0.06] bg-[#0c0f18] grid gap-4 animate-fadeIn ${
                  group.id === 'frame-type'
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : group.id === 'half-walls'
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {group.choices.map((choice) => {
                  const isSelected = selectedChoiceId === choice.id;
                  const priceTag = OPTION_PRICE_TAGS[choice.id];
                  /* In side-walls, let 'None' span full width on sm screens if odd */
                  const isFullWidthSpan = group.id === 'side-walls' && choice.id === 'none';

                  return (
                    <button
                      key={choice.id}
                      className={`flex flex-col justify-between p-5 rounded-2xl text-left border transition-all duration-150 cursor-pointer min-h-[96px] ${
                        isFullWidthSpan ? 'sm:col-span-2' : ''
                      } ${
                        isSelected
                          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-[#121622] border-amber-500/60 text-amber-100 font-semibold shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/25'
                          : 'bg-[#121622] border-white/[0.06] text-slate-300 hover:bg-[#181e2d] hover:border-white/[0.15] hover:text-white'
                      }`}
                      onClick={() => setOption(group.id, choice.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3 w-full">
                        <span className="text-xs sm:text-sm font-semibold leading-snug">{choice.label}</span>
                        <span
                          className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-slate-950" />}
                        </span>
                      </div>

                      {priceTag && (
                        <div className="flex items-center justify-end w-full pt-1">
                          <span
                            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                              priceTag === 'Included'
                                ? 'text-slate-400 bg-white/[0.04] border-white/[0.08]'
                                : priceTag.startsWith('-')
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 font-extrabold'
                                : 'text-amber-400 bg-amber-500/10 border-amber-500/25 font-extrabold'
                            }`}
                          >
                            {priceTag}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 3D CAD Model Dimensions */}
      {Object.keys(productDef.models).length > 1 && (
        <div className="bg-[#121622] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
                <span>📐</span>
                <span>3D Model Procedural Dimensions</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Scale real-world CAD mesh dimensions on the fly</p>
            </div>
            <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full">
              Live Mesh
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3.5 pt-1">
            {Object.entries(productDef.models).map(([modelSizeId, modelData]) => {
              const isSelected = currentSizeId === modelSizeId;
              const shortLabel = modelData.label.replace(' Canopy', '');
              return (
                <button
                  key={modelSizeId}
                  className={`py-4 px-3 text-center rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[84px] ${
                    isSelected
                      ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-[#121622] border-amber-500/60 text-amber-200 font-bold shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/25'
                      : 'bg-[#0a0d14] border-white/[0.06] text-slate-300 hover:bg-[#121622] hover:border-white/[0.15] hover:text-white'
                  }`}
                  onClick={() => setSize(modelSizeId)}
                  aria-pressed={isSelected}
                  title={`${modelData.label} (${modelData.physicalWidthInches}"×${modelData.physicalDepthInches}")`}
                >
                  <span className="text-sm font-bold">{shortLabel}</span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
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
