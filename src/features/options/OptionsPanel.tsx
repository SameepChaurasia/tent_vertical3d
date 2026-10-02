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
    <div className="options-panel">
      {/* Physical Model Dimensions Selector */}
      {Object.keys(productDef.models).length > 1 && (
        <div className="option-group">
          <h3 className="option-group-label">CANOPY DIMENSIONS</h3>
          <div className="option-choices">
            {Object.entries(productDef.models).map(([modelSizeId, modelData]) => (
              <button
                key={modelSizeId}
                className={`option-choice-button ${
                  currentSizeId === modelSizeId ? 'option-choice-selected' : ''
                }`}
                onClick={() => setSize(modelSizeId)}
                aria-pressed={currentSizeId === modelSizeId}
                aria-label={`Canopy Dimensions: ${modelData.label}`}
              >
                {modelData.label}
              </button>
            ))}
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
          <div key={group.id} className="option-group">
            <h3 className="option-group-label">{group.label.toUpperCase()}</h3>
            <div className="option-choices">
              {group.choices.map((choice) => (
                <button
                  key={choice.id}
                  className={`option-choice-button ${
                    selectedChoiceId === choice.id ? 'option-choice-selected' : ''
                  }`}
                  onClick={() => setOption(group.id, choice.id)}
                  aria-pressed={selectedChoiceId === choice.id}
                  aria-label={`${group.label}: ${choice.label}`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
