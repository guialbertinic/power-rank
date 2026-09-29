import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { ApiError, createGame, createParty, fetchProfile } from './api';
import type { Profile } from './game/cosmetics';
import { MODES, poolFor, type Mode } from './game/modes';
import { isPartyCode } from './game/party';
import { SLOTS } from './game/scoring';
import type { CharacterInfo } from './game/types';
import { loadCatalog, POOL, POOL_BY_ID, rememberCharacters } from './data';
import { clearIdentity, forgetToken, loadIdentity, loadMode, saveIdentity, saveMode, type Identity } from './nick';
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
import CasinoScreen from './components/CasinoScreen';

// Tela de revisão da base (http://localhost:5173/?review). Só existe em dev: sai do build de produção.
const ReviewScreen = import.meta.env.DEV ? lazy(() => import('./components/ReviewScreen')) : null;
const showReview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('review');
// Link de convite da party (?sala=ABCDEF): lido uma vez ao abrir o jogo.
const INVITE_CODE = isPartyCode(codeFromUrl()) ? codeFromUrl() : '';

type State =
  /** Escolher o nick: primeira tela de quem ainda não tem um (ou cujo nick deixou de valer). */
  | { phase: 'nick'; reason: string | null }
  | { phase: 'intro' }
  /** Loja e personalização do perfil. */
  | { phase: 'shop' }
  /** Cassino (caça-níquel), só para contas. */
  | { phase: 'casino' }
  /** Na party, o estado do jogo vem da sala (PartyScreen); aqui só fica como entrar nela. */
  | { phase: 'party'; code: string; pid: string }
  | {
      phase: 'playing';
      mode: Mode;
      gameId: string;
      drawn: CharacterInfo[];
      index: number;
      slots: (CharacterInfo | null)[];
    }
  | { phase: 'result'; mode: Mode; gameId: string; slots: CharacterInfo[] };

type Action =
  | { type: 'start'; mode: Mode; gameId: string; drawn: CharacterInfo[] }
  | { type: 'party'; code: string; pid: string }
  | { type: 'place'; slot: number }
  | { type: 'nick'; reason?: string }
  | { type: 'shop' }
  | { type: 'casino' }
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
        return { phase: 'result', mode: state.mode, gameId: state.gameId, slots: slots as CharacterInfo[] };
      }
      return { ...state, index, slots };
    }
    case 'party':
      return { phase: 'party', code: action.code, pid: action.pid };
    case 'nick':
      return { phase: 'nick', reason: action.reason ?? null };
    case 'shop':
      return { phase: 'shop' };
    case 'casino':
      return { phase: 'casino' };
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
 * Pede a partida ao servidor (é ele que sorteia e guarda a resposta certa) e já baixa as imagens dos
 * personagens sorteados, para cada revelação ser instantânea. Sem servidor não tem partida.
 */
async function newGame(
  identity: Identity,
  mode: Mode,
): Promise<{ gameId: string; drawn: CharacterInfo[] } | 'unauthorized' | 'offline'> {
  const game = await createGame(identity.name, identity.token, mode);
  if (game === 'unauthorized') return game;
  if (!game) return 'offline';
  rememberCharacters(game.characters);
  await preloadImages(game.characters);
  return { gameId: game.gameId, drawn: game.characters };
}

const isModeAvailable = (mode: Mode) => poolFor(mode, POOL).length >= SLOTS;

function Game() {
  const [identity, setIdentity] = useState(loadIdentity);
  const [state, dispatch] = useReducer(reducer, identity, initialState);
  const [pendingInvite, setPendingInvite] = useState(identity ? '' : INVITE_CODE);
  const [mode, setMode] = useState(() => {
    const saved = loadMode();
    return isModeAvailable(saved) ? saved : 'anime';
  });
  const [starting, setStarting] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [soloError, setSoloError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  /** Trocou o nick, criou a conta ou o nick da conta mudou em outro dispositivo. */
  const changeIdentity = (next: Identity) => {
    // O token da conta passa a ficar guardado com o nick novo.
    if (identity?.token && identity.name !== next.name) forgetToken(identity.name);
    saveIdentity(next);
    setIdentity(next);
  };

  /** Perfil vindo do servidor; se o nick da conta foi trocado em outro dispositivo, adota o nick novo. */
  const applyProfile = (p: Profile) => {
    setProfile(p);
    if (identity?.token && p.name && p.name !== identity.name) changeIdentity({ name: p.name, token: identity.token });
  };

  /** Conta: sai dela neste navegador. Convidado: vai para a tela do nick para entrar numa conta. */
  const leave = () => {
    if (identity?.token) {
      clearIdentity(identity);
      setIdentity(null);
    }
    setProfile(null);
    dispatch({ type: 'nick' });
  };

  // Saldo e visual são recarregados ao voltar para a home ou abrir a loja (depois de partidas e da party).
  const token = identity?.token;
  const name = identity?.name;
  useEffect(() => {
    if (!name || !token || (state.phase !== 'intro' && state.phase !== 'shop' && state.phase !== 'casino')) return;
    let cancelled = false;
    fetchProfile({ name, token })
      .then((p) => {
        if (!cancelled) applyProfile(p);
      })
      .catch(() => {
        // Sem conexão: a home funciona sem saldo e sem loja.
      });
    return () => {
      cancelled = true;
    };
  }, [name, token, state.phase]);

  /** Forçar sincronização: busca de novo o perfil (ex: o jogador comprou algo em outro dispositivo). */
  const refreshProfile = async () => {
    if (!name || !token) return;
    try {
      applyProfile(await fetchProfile({ name, token }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        dispatch({ type: 'nick', reason: 'Confirme seu nick de novo para continuar.' });
      }
      throw err;
    }
  };

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
        // Convidado cujo nick virou conta de outra pessoa, ou token que deixou de valer.
        const reason = identity.token
          ? 'Confirme seu nick de novo para continuar.'
          : 'Esse nick agora é de uma conta. Entre com a senha ou escolha outro.';
        dispatch({ type: 'nick', reason });
      } else if (game === 'offline') {
        setSoloError('Sem conexão com o servidor. Tente de novo.');
      } else {
        setSoloError(null);
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
      : state.phase === 'casino'
        ? 'Cassino'
      : MODES.find((m) => m.id === (state.phase === 'playing' || state.phase === 'result' ? state.mode : mode))?.label;

  return (
    <main className="app">
      {state.phase === 'intro' && identity && !showReview && (
        <ProfileBar
          identity={identity}
          profile={profile}
          onOpenShop={() => dispatch({ type: 'shop' })}
          onOpenCasino={() => dispatch({ type: 'casino' })}
          onIdentityChange={changeIdentity}
          onLeave={leave}
          onRefresh={refreshProfile}
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
          <ReviewScreen />
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
          soloError={soloError}
        />
      )}
      {state.phase === 'casino' && identity?.token && profile && (
        <CasinoScreen identity={{ ...identity, token: identity.token }} profile={profile} onProfileChange={setProfile} />
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

type CatalogStatus = 'loading' | 'ready' | 'error';

/**
 * Carrega o catálogo público de personagens (sem `power`) antes de montar o jogo: o sorteio, os avatares e a
 * loja dependem dele. Sem conexão, mostra a opção de tentar de novo.
 */
export default function App() {
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const load = () => {
    setStatus('loading');
    loadCatalog().then(
      () => setStatus('ready'),
      () => setStatus('error'),
    );
  };
  useEffect(load, []);

  if (status === 'ready') return <Game />;
  return (
    <main className="app">
      <section className="panel catalog-status">
        {status === 'loading' ? (
          <p className="muted">Carregando...</p>
        ) : (
          <>
            <p className="error">Não foi possível conectar ao servidor.</p>
            <button className="btn btn-primary" onClick={load}>
              Tentar de novo
            </button>
          </>
        )}
      </section>
    </main>
  );
}
