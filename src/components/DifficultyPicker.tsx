import { DIFFICULTIES, type Difficulty } from '../game/modes';
import { useI18n } from '../i18n';

interface Props {
  difficulty: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  disabled?: boolean;
}

/** Dificuldade de Animes / Games / Free for All (solo e sala criada): até que fama de personagem pode aparecer. */
export default function DifficultyPicker({ difficulty, onChange, disabled }: Props) {
  const { t } = useI18n();
  return (
    <div className="setting difficulty-picker">
      <span className="setting-label" id="difficulty-label">
        {t('diff.label')}
      </span>
      <div className="setting-options" role="radiogroup" aria-labelledby="difficulty-label">
        {DIFFICULTIES.map(({ id }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === difficulty}
            className={`setting-option difficulty-option${id === difficulty ? ' selected' : ''}`}
            onClick={() => onChange(id)}
            disabled={disabled}
          >
            {t(`diff.${id}`)}
          </button>
        ))}
      </div>
      <p className="setting-hint">{t(`diff.${difficulty}Hint`)}</p>
    </div>
  );
}
