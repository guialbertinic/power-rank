import { lazy, Suspense, useReducer, useState } from 'react';
import characters from '../data/characters.json';
import { createGame } from './api';
import { drawCharacters } from './game/draw';
import { MODES, poolFor, type Mode } from './game/modes';
import { SLOTS } from './game/scoring';
import type { Character } from './game/types';
import { loadMode, loadNick, saveMode, saveNick } from './nick';
import { preloadImages } from './ui/fallback';
import IntroScreen from './components/IntroScreen';
import ModePicker from './components/ModePicker';
import PlayingScreen from './components/PlayingScreen';
import ResultScreen from './components/ResultScreen';

const POOL = characters as Character[];
const POOL_BY_ID = new Map(POOL.map((c) => [c.id, c]));

// Tela de revisão da base (http://localhost:5173/?review). Só existe em dev: sai do build de produção.
const ReviewScreen = import.meta.env.DEV ? lazy(() => import('./components/ReviewScreen')) : null;
const showReview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('review');

/** `gameId` é null quando a partida foi sorteada localmente (sem API): aí ela não vai pro ranking. */
type State =
  | { phase: 'intro' }
  | {
      phase: 'playing';
      mode: Mode;
      gameId: string | null;
      drawn: Character[];
      index: number;
      slots: (Character | null)[];
    }
  | { phase: 'result'; mode: Mode; gameId: string | null; slots: Character[] };

type Action =
  | { type: 'start'; mode: Mode; gameId: string | null; drawn: Character[] }
  | { type: 'place'; slot: number }
  | { type: 'home' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        mode: action.mode,
        gameId: action.gameId,
        drawn: action.drawn,
        index: 0,
        slots: Array(SLOTS).fill(null),
      };
    case 'place': {
      if (state.phase !== 'playing' || state.slots[action.slot]) return state;
      const slots = [...state.slots];
      slots[action.slot] = state.drawn[state.index];
      const index = state.index + 1;
      if (index >= state.drawn.length) {
        return { phase: 'result', mode: state.mode, gameId: state.gameId, slots: slots as Character[] };
      }
      return { ...state, index, slots };
    }
    case 'home':
      return { phase: 'intro' };
  }
}

/**
 * Pede a partida ao servidor (ou sorteia localmente se a API falhar) e já baixa as imagens
 * dos personagens sorteados, para cada revelação ser instantânea.
 */
async function newGame(nick: string, mode: Mode): Promise<{ gameId: string | null; drawn: Character[] }> {
  const game = await createGame(nick, mode);
  const fromServer = game?.characterIds.map((id) => POOL_BY_ID.get(id));
  const result =
    game && fromServer?.every(Boolean)
      ? { gameId: game.gameId, drawn: fromServer as Character[] }
      : { gameId: null, drawn: drawCharacters(poolFor(mode, POOL), SLOTS) };
  await preloadImages(result.drawn);
  return result;
}

const isModeAvailable = (mode: Mode) => poolFor(mode, POOL).length >= SLOTS;

export default function App() {
  const [state, dispatch] = useReducer(reducer, { phase: 'intro' });
  const [nick, setNick] = useState(loadNick);
  const [mode, setMode] = useState(() => {
    const saved = loadMode();
    return isModeAvailable(saved) ? saved : 'anime';
  });
  const [starting, setStarting] = useState(false);

  const changeMode = (next: Mode) => {
    setMode(next);
    saveMode(next);
  };

  const start = async () => {
    const trimmed = nick.trim();
    if (!trimmed) return;
    saveNick(trimmed);
    setStarting(true);
    try {
      dispatch({ type: 'start', mode, ...(await newGame(trimmed, mode)) });
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="app">
      <header className={`app-header${state.phase === 'intro' ? ' hero' : ''}`}>
        {/* Na tela inicial o seletor de categoria fica no título; nas outras, só o nome da categoria jogada. */}
        {state.phase === 'intro' && !showReview ? (
          <ModePicker mode={mode} onChange={changeMode} isAvailable={isModeAvailable} disabled={starting} />
        ) : (
          <span className="title-eyebrow">
            {MODES.find((m) => m.id === (state.phase === 'intro' ? mode : state.mode))?.label}
          </span>
        )}
        <h1>
          <span className="title-main">
            Power <em>Rank</em>
          </span>
        </h1>
      </header>
      {ReviewScreen && showReview && (
        <Suspense>
          <ReviewScreen characters={POOL} />
        </Suspense>
      )}
      {!showReview && state.phase === 'intro' && (
        <IntroScreen
          nick={nick}
          onNickChange={setNick}
          mode={mode}
          canStart={isModeAvailable(mode)}
          starting={starting}
          onStart={start}
        />
      )}
      {state.phase === 'playing' && (
        <PlayingScreen
          current={state.drawn[state.index]}
          index={state.index}
          slots={state.slots}
          onPlace={(slot) => dispatch({ type: 'place', slot })}
        />
      )}
      {state.phase === 'result' && (
        <ResultScreen
          mode={state.mode}
          gameId={state.gameId}
          nick={nick.trim()}
          slots={state.slots}
          starting={starting}
          onRestart={start}
          onChangeNick={() => dispatch({ type: 'home' })}
        />
      )}
    </main>
  );
}
