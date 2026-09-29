import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { createGame, createParty, fetchProfile } from './api';
import type { Profile } from './game/cosmetics';
import { drawCharacters } from './game/draw';
import { MODES, poolFor, type Mode } from './game/modes';
import { isPartyCode } from './game/party';
import { SLOTS } from './game/scoring';
import type { Character } from './game/types';
import { POOL, POOL_BY_ID } from './data';
import { loadIdentity, loadMode, saveIdentity, saveMode, type Identity } from './nick';
import { clearCodeFromUrl, codeFromUrl, newPid, partyPid, rememberPartyPid } from './party/session';
import { preloadImages } from './ui/fallback';
import IntroScreen from './components/IntroScreen';
import ModePicker from './components/ModePicker';
import ProfileBar from './components/ProfileBar';
import NickScreen from './components/NickScreen';
import PartyScreen from './components/party/PartyScreen';
import PlayingScreen from './components/PlayingScreen';
import ResultScreen from './components/ResultScreen';
import ShopScreen from './components/ShopScreen';

// Tela de revisão da base (http://localhost:5173/?review). Só existe em dev: sai do build de produção.
const ReviewScreen = import.meta.env.DEV ? lazy(() => import('./components/ReviewScreen')) : null;
const showReview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('review');
// Link de convite da party (?sala=ABCDEF): lido uma vez ao abrir o jogo.
const INVITE_CODE = isPartyCode(codeFromUrl()) ? codeFromUrl() : '';

/** `gameId` é null quando a partida foi sorteada localmente (sem API): aí ela não vai pro ranking. */
type State =
  /** Escolher o nick: primeira tela de quem ainda não tem um (ou cujo nick deixou de valer). */
  | { phase: 'nick'; reason: string | null }
  | { phase: 'intro' }
  /** Loja e personalização do perfil. */
  | { phase: 'shop' }
  /** Na party, o estado do jogo vem da sala (PartyScreen); aqui só fica como entrar nela. */
  | { phase: 'party'; code: string; pid: string }
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
  | { type: 'party'; code: string; pid: string }
  | { type: 'place'; slot: number }
  | { type: 'nick'; reason?: string }
  | { type: 'shop' }
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
    case 'party':
      return { phase: 'party', code: action.code, pid: action.pid };
    case 'nick':
      return { phase: 'nick', reason: action.reason ?? null };
    case 'shop':
      return { phase: 'shop' };
    case 'home':
      return { phase: 'intro' };
  }
}

/** Sem nick, começa pedindo um. Com nick e link de convite, entra direto na sala. */
function initialState(identity: Identity | null): State {
  if (!identity) return { phase: 'nick', reason: null };
  if (INVITE_CODE) {
    clearCodeFromUrl();
    return { phase: 'party', code: INVITE_CODE, pid: partyPid(INVITE_CODE) };
  }
  return { phase: 'intro' };
}

/**
 * Pede a partida ao servidor (ou sorteia localmente se a API falhar) e já baixa as imagens
 * dos personagens sorteados, para cada revelação ser instantânea.
 */
async function newGame(
  identity: Identity,
  mode: Mode,
): Promise<{ gameId: string | null; drawn: Character[] } | 'unauthorized'> {
  const game = await createGame(identity.name, identity.token, mode);
  if (game === 'unauthorized') return game;
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
  const [identity, setIdentity] = useState(loadIdentity);
  const [state, dispatch] = useReducer(reducer, identity, initialState);
  const [pendingInvite, setPendingInvite] = useState(identity ? '' : INVITE_CODE);
  const [mode, setMode] = useState(() => {
    const saved = loadMode();
    return isModeAvailable(saved) ? saved : 'anime';
  });
  const [starting, setStarting] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Saldo e visual são recarregados ao voltar para a home ou abrir a loja (depois de partidas e da party).
  const token = identity?.token;
  const name = identity?.name;
  useEffect(() => {
    if (!name || !token || (state.phase !== 'intro' && state.phase !== 'shop')) return;
    let cancelled = false;
    fetchProfile({ name, token })
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // Sem conexão: a home funciona sem saldo e sem loja.
      });
    return () => {
      cancelled = true;
    };
  }, [name, token, state.phase]);

  const changeMode = (next: Mode) => {
    setMode(next);
    saveMode(next);
  };

  const onNickChosen = (chosen: Identity) => {
    saveIdentity(chosen);
    setIdentity(chosen);
    if (pendingInvite) {
      clearCodeFromUrl();
      dispatch({ type: 'party', code: pendingInvite, pid: partyPid(pendingInvite) });
      setPendingInvite('');
    } else {
      dispatch({ type: 'home' });
    }
  };

  const start = async () => {
    if (!identity) return dispatch({ type: 'nick' });
    setStarting(true);
    try {
      const game = await newGame(identity, mode);
      if (game === 'unauthorized') {
        dispatch({ type: 'nick', reason: 'Confirme seu nick de novo para continuar.' });
      } else {
        dispatch({ type: 'start', mode, ...game });
      }
    } finally {
      setStarting(false);
    }
  };

  const createRoom = async () => {
    setPartyError(null);
    setStarting(true);
    try {
      const pid = newPid();
      const code = await createParty(mode, pid);
      rememberPartyPid(code, pid);
      dispatch({ type: 'party', code, pid });
    } catch (err) {
      setPartyError(err instanceof Error ? err.message : 'Não foi possível criar a sala');
    } finally {
      setStarting(false);
    }
  };

  const joinRoom = (code: string) => {
    setPartyError(null);
    dispatch({ type: 'party', code, pid: partyPid(code) });
  };

  const isHome = state.phase === 'intro' || state.phase === 'nick';
  const eyebrow =
    state.phase === 'party'
      ? 'Party'
      : state.phase === 'shop'
        ? 'Loja'
      : MODES.find((m) => m.id === (state.phase === 'playing' || state.phase === 'result' ? state.mode : mode))?.label;

  return (
    <main className="app">
      {state.phase === 'intro' && identity && !showReview && (
        <ProfileBar
          identity={identity}
          profile={profile}
          onOpenShop={() => dispatch({ type: 'shop' })}
          onChangeNick={() => dispatch({ type: 'nick' })}
          disabled={starting}
        />
      )}
      <header className={`app-header${isHome && !showReview ? ' hero' : ''}`}>
        {/* Na home o seletor de categoria fica no título; nas outras telas, só o nome da categoria/modo. */}
        {state.phase === 'intro' && !showReview && (
          <ModePicker mode={mode} onChange={changeMode} isAvailable={isModeAvailable} disabled={starting} />
        )}
        {!isHome && <span className="title-eyebrow">{eyebrow}</span>}
        <h1>
          <span className="title-main">
            Power <em>Rank</em>
          </span>
        </h1>
        {!isHome && !showReview && (
          <button className="home-button" onClick={() => dispatch({ type: 'home' })}>
            Início
          </button>
        )}
      </header>

      {ReviewScreen && showReview && (
        <Suspense>
          <ReviewScreen characters={POOL} />
        </Suspense>
      )}
      {!showReview && state.phase === 'nick' && (
        <NickScreen inviteCode={pendingInvite} reason={state.reason} onDone={onNickChosen} />
      )}
      {!showReview && state.phase === 'intro' && identity && (
        <IntroScreen
          identity={identity}
          mode={mode}
          canStart={isModeAvailable(mode)}
          busy={starting}
          onSolo={start}
          onCreateParty={createRoom}
          onJoinParty={joinRoom}
          partyError={partyError}
        />
      )}
      {state.phase === 'shop' && identity?.token && profile && (
        <ShopScreen identity={{ ...identity, token: identity.token }} profile={profile} onProfileChange={setProfile} />
      )}
      {state.phase === 'party' && identity && (
        <PartyScreen
          key={state.code}
          code={state.code}
          pid={state.pid}
          nick={identity.name}
          token={identity.token}
          charactersById={POOL_BY_ID}
          onExit={() => dispatch({ type: 'home' })}
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
          nick={identity?.name ?? ''}
          slots={state.slots}
          starting={starting}
          onRestart={start}
        />
      )}
    </main>
  );
}
