import {
  useConfiguratorStore,
  selectProductDefinition,
  selectCurrentOptions,
  selectCurrentSizeId,
} from '../configurator/configurator.store';

/**
 * Product options panel — renders pill-style selectors for each option group
 * and physical canopy dimensions (5x5, 6.5x6.5, 8x8 models).
 * Matches the reference UI layout (Size, Side Walls, Half Walls).
 */
export function OptionsPanel() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const currentSizeId = useConfiguratorStore(selectCurrentSizeId);
  const setOption = useConfiguratorStore((s) => s.setOption);
  const setSize = useConfiguratorStore((s) => s.setSize);

  if (!productDef) return null;

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Physical Model Dimensions Selector */}
      {Object.keys(productDef.models).length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Canopy Dimensions
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(productDef.models).map(([modelSizeId, modelData]) => {
              const isSelected = currentSizeId === modelSizeId;
              return (
                <button
                  key={modelSizeId}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-left border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                      : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white'
                  }`}
                  onClick={() => setSize(modelSizeId)}
                  aria-pressed={isSelected}
                  aria-label={`Canopy Dimensions: ${modelData.label}`}
                >
                  <span>{modelData.label}</span>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected ? 'border-amber-500 bg-amber-500' : 'border-white/20 bg-transparent'
                    }`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

        return (
          <div key={group.id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              {group.label}
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {group.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-left border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white'
                    }`}
                    onClick={() => setOption(group.id, choice.id)}
                    aria-pressed={isSelected}
                    aria-label={`${group.label}: ${choice.label}`}
                  >
                    <span className="pr-2">{choice.label}</span>
                    <span
                      className={`w-3.5 h-3.5 flex-shrink-0 rounded-full border flex items-center justify-center transition-all ${
                        isSelected ? 'border-amber-500 bg-amber-500' : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
