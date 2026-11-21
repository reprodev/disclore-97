import { BURN_PRESETS } from './burnPresets';

export type PresetListProps = {
  onSelect: (text: string) => void;
  disabled?: boolean;
};

/** Accessible list of preset inputs; selecting one passes its text to `onSelect`. */
export function PresetList({ onSelect, disabled = false }: PresetListProps) {
  return (
    <ul className="preset-list" aria-label="Presets">
      {BURN_PRESETS.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="preset-list__item"
            disabled={disabled}
            onClick={() => onSelect(p.text)}
          >
            {p.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
