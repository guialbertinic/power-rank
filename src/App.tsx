import { useReducer } from 'react';
import characters from '../data/characters.json';
import { drawCharacters } from './game/draw';
import { SLOTS } from './game/scoring';
import type { Character } from './game/types';
import IntroScreen from './components/IntroScreen';
import PlayingScreen from './components/PlayingScreen';
import ResultScreen from './components/ResultScreen';

const POOL = characters as Character[];

type State =
  | { phase: 'intro' }
  | { phase: 'playing'; drawn: Character[]; index: number; slots: (Character | null)[] }
  | { phase: 'result'; slots: Character[] };

type Action = { type: 'start'; drawn: Character[] } | { type: 'place'; slot: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { phase: 'playing', drawn: action.drawn, index: 0, slots: Array(SLOTS).fill(null) };
    case 'place': {
      if (state.phase !== 'playing' || state.slots[action.slot]) return state;
      const slots = [...state.slots];
      slots[action.slot] = state.drawn[state.index];
      const index = state.index + 1;
      if (index >= state.drawn.length) return { phase: 'result', slots: slots as Character[] };
      return { ...state, index, slots };
    }
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { phase: 'intro' });
  const start = () => dispatch({ type: 'start', drawn: drawCharacters(POOL, SLOTS) });

  return (
    <main className="app">
      <header className="app-header">
        <h1>Anime Power Rank</h1>
      </header>
      {state.phase === 'intro' && <IntroScreen poolSize={POOL.length} onStart={start} />}
      {state.phase === 'playing' && (
        <PlayingScreen
          current={state.drawn[state.index]}
          index={state.index}
          slots={state.slots}
          onPlace={(slot) => dispatch({ type: 'place', slot })}
        />
      )}
      {state.phase === 'result' && <ResultScreen slots={state.slots} onRestart={start} />}
    </main>
  );
}
