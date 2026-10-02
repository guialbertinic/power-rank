import { GENERATIONS } from '../game/modes';
import { useI18n } from '../i18n';

interface Props {
  /** Gerações ligadas (sempre pelo menos uma). */
  generations: number[];
  onChange: (generations: number[]) => void;
  disabled?: boolean;
}

/** Filtro do modo Pokémon (no lugar da dificuldade): liga/desliga cada geração que pode aparecer (solo e sala criada). */
export default function GenerationPicker({ generations, onChange, disabled }: Props) {
  const { t } = useI18n();
  const all = generations.length === GENERATIONS.length;
  const toggle = (gen: number) => {
    const on = generations.includes(gen);
    // A última ligada não desliga: sem geração não há sorteio.
    if (on && generations.length === 1) return;
    onChange(on ? generations.filter((g) => g !== gen) : [...generations, gen].sort((a, b) => a - b));
  };
  return (
    <div className="setting gen-picker" role="group" aria-label={t('gen.label')}>
      <span className="setting-label">{t('gen.label')}</span>
      <div className="setting-options">
        {GENERATIONS.map((gen) => {
          const on = generations.includes(gen);
          return (
            <button
              key={gen}
              type="button"
              className={`setting-option gen-option${on ? ' selected' : ''}`}
              aria-pressed={on}
              aria-label={t('gen.aria', { n: gen })}
              onClick={() => toggle(gen)}
              disabled={disabled}
            >
              {gen}
            </button>
          );
        })}
        <button
          type="button"
          className={`setting-option gen-all${all ? ' selected' : ''}`}
          aria-pressed={all}
          onClick={() => onChange([...GENERATIONS])}
          disabled={disabled}
        >
          {t('gen.all')}
        </button>
      </div>
    </div>
  );
}
