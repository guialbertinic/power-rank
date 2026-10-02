import { FFA_CATEGORIES } from '../game/modes';
import type { Category } from '../game/types';
import { modeLabel, useI18n } from '../i18n';

interface Props {
  /** Categorias ligadas (sempre pelo menos uma). */
  categories: Category[];
  onChange: (categories: Category[]) => void;
  disabled?: boolean;
}

/** Free for All: liga/desliga as categorias que entram na mistura (solo e sala criada; o diário usa as padrão). */
export default function CategoryPicker({ categories, onChange, disabled }: Props) {
  const { t } = useI18n();
  const toggle = (category: Category) => {
    const on = categories.includes(category);
    // A última ligada não desliga: sem categoria não há sorteio.
    if (on && categories.length === 1) return;
    onChange(FFA_CATEGORIES.filter((c) => (c === category ? !on : categories.includes(c))));
  };
  return (
    <div className="setting category-picker" role="group" aria-label={t('ffa.label')}>
      <span className="setting-label">{t('ffa.label')}</span>
      <div className="setting-options">
        {FFA_CATEGORIES.map((category) => {
          const on = categories.includes(category);
          return (
            <button
              key={category}
              type="button"
              className={`setting-option${on ? ' selected' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(category)}
              disabled={disabled}
            >
              {modeLabel(t, category)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
