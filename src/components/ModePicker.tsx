import { MODES, type Mode } from '../game/modes';

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  /** Categorias sem personagens suficientes aparecem como "em breve". */
  isAvailable: (mode: Mode) => boolean;
  disabled?: boolean;
}

/** Seletor de categoria (Animes / Games / Free for All), exibido no título da tela inicial. */
export default function ModePicker({ mode, onChange, isAvailable, disabled }: Props) {
  return (
    <div className="mode-picker" role="radiogroup" aria-label="Categoria">
      {MODES.map((m) => {
        const enabled = isAvailable(m.id);
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === mode}
            className={`mode-option${m.id === mode ? ' selected' : ''}`}
            onClick={() => onChange(m.id)}
            disabled={disabled || !enabled}
          >
            {m.label}
            {!enabled && <small>em breve</small>}
          </button>
        );
      })}
    </div>
  );
}
