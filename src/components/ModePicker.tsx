import { MODES, type Mode } from '../game/modes';
import { modeLabel, useI18n } from '../i18n';

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  /** Categorias sem personagens suficientes aparecem como "em breve". */
  isAvailable: (mode: Mode) => boolean;
  disabled?: boolean;
}

/** Seletor de categoria (Animes / Games / Filmes e Séries / Pokémon / Free for All), exibido na home, acima de Solo/Party (na tela, "Modo"). */
export default function ModePicker({ mode, onChange, isAvailable, disabled }: Props) {
  const { t } = useI18n();
  return (
    <div className="mode-picker" role="radiogroup" aria-label={t('mode.category')}>
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
            {modeLabel(t, m.id)}
            {!enabled && <small>{t('mode.soon')}</small>}
          </button>
        );
      })}
    </div>
  );
}
