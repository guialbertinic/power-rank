import { GENERATIONS } from '../game/modes';
import { useI18n } from '../i18n';

interface Props {
  /** Gerações ligadas (sempre pelo menos uma). */
  generations: number[];
  onChange: (generations: number[]) => void;
  disabled?: boolean;
}

/** Filtro do modo Pokémon: liga/desliga cada geração que pode aparecer no sorteio (solo e party). */
export default function GenerationPicker({ generations, onChange, disabled }: Props) {
  const { t } = useI18n();
  const toggle = (gen: number) => {
    const on = generations.includes(gen);
    // A última ligada não desliga: sem geração não há sorteio.
    if (on && generations.length === 1) return;
    onChange(on ? generations.filter((g) => g !== gen) : [...generations, gen].sort((a, b) => a - b));
  };
  return (
    <div className="gen-picker" role="group" aria-label={t('gen.label')}>
      <span className="gen-picker-label">{t('gen.label')}</span>
      <div className="gen-options">
        {GENERATIONS.map((gen) => {
          const on = generations.includes(gen);
          return (
            <button
              key={gen}
              type="button"
              className={`gen-option${on ? ' selected' : ''}`}
              aria-pressed={on}
              aria-label={t('gen.aria', { n: gen })}
              onClick={() => toggle(gen)}
              disabled={disabled}
            >
              {gen}
            </button>
          );
        })}
      </div>
    </div>
  );
}
