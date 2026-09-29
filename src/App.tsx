import { useReducer, useState } from 'react';
import characters from '../data/characters.json';
import { createGame } from './api';
import { drawCharacters } from './game/draw';
import { SLOTS } from './game/scoring';
import type { Character } from './game/types';
import IntroScreen from './components/IntroScreen';
import PlayingScreen from './components/PlayingScreen';
import ResultScreen from './components/ResultScreen';

const POOL = characters as Character[];
const POOL_BY_ID = new Map(POOL.map((c) => [c.id, c]));

/** `gameId` é null quando a partida foi sorteada localmente (sem API): aí não dá pra enviar ao ranking. */
type State =
  | { phase: 'intro' }
  | { phase: 'playing'; gameId: string | null; drawn: Character[]; index: number; slots: (Character | null)[] }
  | { phase: 'result'; gameId: string | null; slots: Character[] };

type Action = { type: 'start'; gameId: string | null; drawn: Character[] } | { type: 'place'; slot: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { phase: 'playing', gameId: action.gameId, drawn: action.drawn, index: 0, slots: Array(SLOTS).fill(null) };
    case 'place': {
      if (state.phase !== 'playing' || state.slots[action.slot]) return state;
      const slots = [...state.slots];
      slots[action.slot] = state.drawn[state.index];
      const index = state.index + 1;
      if (index >= state.drawn.length) return { phase: 'result', gameId: state.gameId, slots: slots as Character[] };
      return { ...state, index, slots };
    }
  }
}

/** Pede a partida ao servidor; se a API falhar ou devolver um id desconhecido, sorteia localmente. */
async function newGame(): Promise<{ gameId: string | null; drawn: Character[] }> {
  const game = await createGame();
  const drawn = game?.characterIds.map((id) => POOL_BY_ID.get(id));
  if (game && drawn?.every(Boolean)) return { gameId: game.gameId, drawn: drawn as Character[] };
  return { gameId: null, drawn: drawCharacters(POOL, SLOTS) };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { phase: 'intro' });
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      dispatch({ type: 'start', ...(await newGame()) });
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>Anime Power Rank</h1>
      </header>
      {state.phase === 'intro' && <IntroScreen poolSize={POOL.length} starting={starting} onStart={start} />}
      {state.phase === 'playing' && (
        <PlayingScreen
          current={state.drawn[state.index]}
          index={state.index}
          slots={state.slots}
          onPlace={(slot) => dispatch({ type: 'place', slot })}
        />
      )}
      {state.phase === 'result' && (
        <ResultScreen gameId={state.gameId} slots={state.slots} starting={starting} onRestart={start} />
      )}
    </main>
  );
}
