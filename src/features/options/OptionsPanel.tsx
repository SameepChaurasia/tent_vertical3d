import {
  useConfiguratorStore,
  selectProductDefinition,
  selectCurrentOptions,
} from '../configurator/configurator.store';

/**
 * Product options panel — renders pill-style selectors for each option group.
 * Matches the reference UI layout (Size, Side Walls, Half Walls).
 */
export function OptionsPanel() {
  const productDef = useConfiguratorStore(selectProductDefinition);
  const currentOptions = useConfiguratorStore(selectCurrentOptions);
  const setOption = useConfiguratorStore((s) => s.setOption);

  if (!productDef) return null;

  return (
    <div className="options-panel">
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
