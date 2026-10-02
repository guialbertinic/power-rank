import { DEFAULT_DIFFICULTY, GENERATIONS, poolFor, type Difficulty, type Mode } from '../../game/modes';
import type { ClientMessage, PartyState } from '../../game/party';
import { SLOTS } from '../../game/scoring';
import { POOL } from '../../data';
import { useI18n } from '../../i18n';
import DifficultyPicker from '../DifficultyPicker';
import GenerationPicker from '../GenerationPicker';
import ModePicker from '../ModePicker';

type Settings = Extract<ClientMessage, { type: 'settings' }>;

interface Props {
  state: PartyState;
  onChange: (settings: Settings) => void;
}

const isModeAvailable = (mode: Mode) => poolFor(mode, POOL).length >= SLOTS;

/**
 * Configuração da próxima rodada, só para o dono (no lobby e no pódio): categoria e dificuldade ou gerações.
 * Cada toque já vale para a sala; o servidor confere e devolve o estado para todos.
 */
export default function PartySettings({ state, onChange }: Props) {
  const { t } = useI18n();
  // Sala sem filtro = todos os personagens (difícil) ou todas as gerações.
  const difficulty = state.difficulty ?? 'hard';
  const generations = state.generations ?? [...GENERATIONS];

  const send = (next: Partial<Omit<Settings, 'type'>>) => {
    const mode = next.mode ?? state.mode;
    const gens = next.generations ?? generations;
    const diff: Difficulty = next.difficulty ?? state.difficulty ?? DEFAULT_DIFFICULTY;
    const filter = mode === 'pokemon' ? { generations: gens.length < GENERATIONS.length ? gens : undefined } : { difficulty: diff };
    // Filtro que deixa a categoria sem personagens: nem envia (o servidor recusaria).
    if (poolFor(mode, POOL, filter).length < SLOTS) return;
    onChange({ type: 'settings', mode, ...filter });
  };

  return (
    <div className="panel party-settings">
      <h3 className="section-title">{t('lobby.settings')}</h3>
      <ModePicker mode={state.mode} onChange={(mode) => send({ mode })} isAvailable={isModeAvailable} />
      {state.mode === 'pokemon' ? (
        <GenerationPicker generations={generations} onChange={(g) => send({ generations: g })} />
      ) : (
        <DifficultyPicker difficulty={difficulty} onChange={(d) => send({ difficulty: d })} />
      )}
    </div>
  );
}
