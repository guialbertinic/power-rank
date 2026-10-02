import { useEffect, useState } from 'react';
import { DEFAULT_DIFFICULTY, DEFAULT_FFA_CATEGORIES, filterFor, GENERATIONS, poolFor, type Difficulty, type Mode } from '../../game/modes';
import type { ClientMessage, PartyState } from '../../game/party';
import { SLOTS } from '../../game/scoring';
import { POOL } from '../../data';
import { useI18n } from '../../i18n';
import CategoryPicker from '../CategoryPicker';
import DifficultyPicker from '../DifficultyPicker';
import GenerationPicker from '../GenerationPicker';
import ModePicker from '../ModePicker';

type Settings = Extract<ClientMessage, { type: 'settings' }>;

interface Props {
  state: PartyState;
  onChange: (settings: Settings) => void;
}

const isModeAvailable = (mode: Mode) => poolFor(mode, POOL).length >= SLOTS;

/** Sem resposta da sala nesse tempo, a escolha otimista é descartada. */
const PENDING_MS = 4000;

type Filters = Pick<Settings, 'mode' | 'difficulty' | 'generations' | 'categories'>;
const list = (values?: readonly unknown[]) => (values ? [...values].sort().join() : '');
const sameSettings = (a: Filters, b: Filters) =>
  a.mode === b.mode &&
  (a.difficulty ?? null) === (b.difficulty ?? null) &&
  list(a.generations) === list(b.generations) &&
  list(a.categories) === list(b.categories);

/**
 * Configuração da próxima rodada, só para o dono (no lobby e no pódio): categoria e dificuldade ou gerações (e as categorias, no Free for All).
 * Cada toque já vale para a sala; o servidor confere e devolve o estado para todos.
 * A escolha aparece na hora (otimista): esperar a volta do servidor deixava o toque com cara de travado.
 */
export default function PartySettings({ state, onChange }: Props) {
  const { t } = useI18n();
  // Última escolha enviada e ainda não confirmada: sai quando a sala chega nela (outras atualizações, como alguém
  // entrando, não contam) ou, se o servidor recusar, depois de um tempo (a tela volta ao estado da sala).
  const [pending, setPending] = useState<Settings | null>(null);
  useEffect(() => {
    if (pending && sameSettings(pending, state)) setPending(null);
  }, [state, pending]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  const shown = pending ?? state;
  // Sala sem filtro = todos os personagens (difícil) ou todas as gerações.
  const difficulty = shown.difficulty ?? 'hard';
  const generations = shown.generations ?? [...GENERATIONS];
  const categories = shown.categories ?? [...DEFAULT_FFA_CATEGORIES];

  const send = (next: Partial<Omit<Settings, 'type'>>) => {
    const mode = next.mode ?? shown.mode;
    const gens = next.generations ?? generations;
    const diff: Difficulty = next.difficulty ?? shown.difficulty ?? DEFAULT_DIFFICULTY;
    const filter = filterFor(mode, {
      generations: gens.length < GENERATIONS.length ? gens : undefined,
      difficulty: diff,
      categories: next.categories ?? categories,
    });
    // Filtro que deixa a categoria sem personagens: nem envia (o servidor recusaria).
    if (poolFor(mode, POOL, filter).length < SLOTS) return;
    const settings: Settings = { type: 'settings', mode, ...filter, generations: filter.generations && [...filter.generations], categories: filter.categories && [...filter.categories] };
    setPending(settings);
    onChange(settings);
  };

  return (
    <div className="panel party-settings">
      <h3 className="section-title">{t('lobby.settings')}</h3>
      <ModePicker mode={shown.mode} onChange={(mode) => send({ mode })} isAvailable={isModeAvailable} />
      {shown.mode === 'pokemon' ? (
        <GenerationPicker generations={generations} onChange={(g) => send({ generations: g })} />
      ) : (
        <>
          {shown.mode === 'all' && <CategoryPicker categories={categories} onChange={(c) => send({ categories: c })} />}
          <DifficultyPicker difficulty={difficulty} onChange={(d) => send({ difficulty: d })} />
        </>
      )}
    </div>
  );
}
