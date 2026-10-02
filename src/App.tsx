import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import {
  ApiError,
  createGame,
  createParty,
  fetchConfig,
  fetchDaily,
  fetchProfile,
  markAchievementsSeen,
  type DailyStatus,
} from './api';
import type { Profile } from './game/cosmetics';
import { FEATURES, NO_FEATURES } from './game/features';
import { filterFor, GENERATIONS, poolFor, type Difficulty, type Mode, type PoolFilter } from './game/modes';
import { isPartyCode } from './game/party';
import { SLOTS } from './game/scoring';
import type { Category, CharacterInfo } from './game/types';
import { loadCatalog, POOL, POOL_BY_ID, rememberCharacters } from './data';
import {
  clearIdentity,
  forgetToken,
  loadCategories,
  loadDifficulty,
  loadGenerations,
  loadIdentity,
  loadMode,
  loadRecording,
  saveCategories,
  saveDifficulty,
  saveGenerations,
  saveIdentity,
  saveMode,
  saveRecording,
  type Identity,
} from './nick';
import { clearCodeFromUrl, codeFromUrl, newPid, partyPid, rememberPartyPid } from './party/session';
import { preloadImages } from './ui/fallback';
import IntroScreen from './components/IntroScreen';
import ProfileBar from './components/ProfileBar';
import NickScreen from './components/NickScreen';
import PartyScreen from './components/party/PartyScreen';
import PlayingScreen from './components/PlayingScreen';
import ResultScreen from './components/ResultScreen';
import ShopScreen from './components/ShopScreen';
import ArcadeScreen from './components/ArcadeScreen';
import AccountScreen from './components/AccountScreen';
import AchievementUnlocked from './components/AchievementUnlocked';
import AchievementsScreen from './components/AchievementsScreen';
import SettingsMenu from './components/SettingsMenu';
import { LegalLink, LegalProvider } from './components/Legal';
import { SUPPORT_URL } from './links';
import { dailyLabel, I18nProvider, modeLabel, useI18n } from './i18n';

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
  /** Arcade (minigames com moedas), só para contas. */
  | { phase: 'arcade' }
  /** Conquistas (progresso e prêmios), só para contas. */
  | { phase: 'achievements' }
  /** Minha conta: nick, senha, aparelhos, excluir (convidado: criar conta). */
  | { phase: 'account' }
  /** Na party, o estado do jogo vem da sala (PartyScreen); aqui só fica como entrar nela. */
  | { phase: 'party'; code: string; pid: string }
  | {
      phase: 'playing';
      mode: Mode;
      /** Partida do Desafio Diário. */
      daily: boolean;
      gameId: string;
      drawn: CharacterInfo[];
      index: number;
      slots: (CharacterInfo | null)[];
    }
  | { phase: 'result'; mode: Mode; daily: boolean; gameId: string; slots: CharacterInfo[] };

type Action =
  | { type: 'start'; mode: Mode; daily: boolean; gameId: string; drawn: CharacterInfo[] }
  | { type: 'party'; code: string; pid: string }
  | { type: 'place'; slot: number }
  | { type: 'nick'; reason?: string }
  | { type: 'shop' }
  | { type: 'arcade' }
  | { type: 'achievements' }
  | { type: 'account' }
  | { type: 'home' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        mode: action.mode,
        daily: action.daily,
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
        return { phase: 'result', mode: state.mode, daily: state.daily, gameId: state.gameId, slots: slots as CharacterInfo[] };
      }
      return { ...state, index, slots };
    }
    case 'party':
      return { phase: 'party', code: action.code, pid: action.pid };
    case 'nick':
      return { phase: 'nick', reason: action.reason ?? null };
    case 'shop':
      return { phase: 'shop' };
    case 'arcade':
      return { phase: 'arcade' };
    case 'achievements':
      return { phase: 'achievements' };
    case 'account':
      return { phase: 'account' };
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
  daily = false,
  filter: PoolFilter = {},
): Promise<{ gameId: string; drawn: CharacterInfo[]; daily: boolean } | 'unauthorized' | { error: string }> {
  const game = await createGame(identity.name, identity.token, mode, daily, filter);
  if (game === 'unauthorized') return game;
  if (!game) return { error: 'Sem conexão com o servidor. Tente de novo.' }; // traduzido na tela (serverText)
  if ('error' in game) return game;
  rememberCharacters(game.characters);
  await preloadImages(game.characters);
  return { gameId: game.gameId, drawn: game.characters, daily: game.daily };
}

const isModeAvailable = (mode: Mode) => poolFor(mode, POOL).length >= SLOTS;

/**
 * Filtro a enviar: gerações no modo pokemon (só quando nem todas estão ligadas), dificuldade nos outros e as
 * categorias no Free for All.
 */
const poolFilter = (mode: Mode, generations: number[], difficulty: Difficulty, categories: Category[]): PoolFilter =>
  filterFor(mode, { generations: generations.length < GENERATIONS.length ? generations : undefined, difficulty, categories });

/** Com o filtro escolhido sobram personagens para uma partida? */
const canDraw = (mode: Mode, filter: PoolFilter) => poolFor(mode, POOL, filter).length >= SLOTS;

function Game() {
  const { t } = useI18n();
  const [identity, setIdentity] = useState(loadIdentity);
  const [state, dispatch] = useReducer(reducer, identity, initialState);
  const [pendingInvite, setPendingInvite] = useState(identity ? '' : INVITE_CODE);
  const [mode, setMode] = useState(() => {
    const saved = loadMode();
    return isModeAvailable(saved) ? saved : 'anime';
  });
  const [generations, setGenerations] = useState(loadGenerations);
  const [difficulty, setDifficulty] = useState(loadDifficulty);
  const [categories, setCategories] = useState(loadCategories);
  const filter = poolFilter(mode, generations, difficulty, categories);
  const [starting, setStarting] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [soloError, setSoloError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [features, setFeatures] = useState(NO_FEATURES);
  const [recording, setRecording] = useState(loadRecording);

  const changeRecording = (on: boolean) => {
    setRecording(on);
    saveRecording(on);
  };

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
    const phases: State['phase'][] = ['intro', 'shop', 'arcade', 'account'];
    if (!name || !token || !phases.includes(state.phase)) return;
    let cancelled = false;
    fetchProfile({ name, token })
      .then((p) => {
        if (!cancelled) applyProfile(p);
      })
      .catch((err) => {
        // Token que deixou de valer (saiu de todos os aparelhos em outro, senha trocada, conta suspensa): pede o
        // nick de novo. Sem conexão: a home funciona sem saldo e sem loja.
        if (!cancelled && err instanceof ApiError && err.status === 401) dispatch({ type: 'nick', reason: t('app.confirmNick') });
      });
    return () => {
      cancelled = true;
    };
  }, [name, token, state.phase]);

  // Chaves dos minigames (ligadas/desligadas no banco): conferidas ao voltar para a home, onde fica o botão do Arcade.
  // Só contas jogam. Sem conexão, fica como estava (no começo, tudo desligado).
  useEffect(() => {
    if (!token || state.phase !== 'intro') return;
    let cancelled = false;
    fetchConfig()
      .then((c) => {
        if (!cancelled) setFeatures(c.features ?? NO_FEATURES);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, state.phase]);

  // Desafio Diário da categoria: se o jogador ainda pode jogar hoje, conferido ao voltar para a home e ao trocar de
  // categoria (vale também para o convidado). Sem conexão, o botão não aparece.
  useEffect(() => {
    if (!name || state.phase !== 'intro') return;
    let cancelled = false;
    setDaily(null);
    fetchDaily(name, token ?? null, mode)
      .then((d) => {
        if (!cancelled) setDaily(d);
      })
      .catch(() => {
        if (!cancelled) setDaily(null);
      });
    return () => {
      cancelled = true;
    };
  }, [name, token, state.phase, mode]);

  /** Forçar sincronização: busca de novo o perfil (ex: o jogador comprou algo em outro dispositivo). */
  const refreshProfile = async () => {
    if (!name || !token) return;
    try {
      applyProfile(await fetchProfile({ name, token }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        dispatch({ type: 'nick', reason: t('app.confirmNick') });
      }
      throw err;
    }
  };

  /** Fechou o aviso das conquistas novas (ex: as da party): some daqui e o servidor marca como vistas. */
  const dismissAchievements = () => {
    if (!profile || !token) return;
    setProfile({ ...profile, newAchievements: [] });
    markAchievementsSeen(token).catch(() => {});
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    saveMode(next);
  };

  const changeGenerations = (next: number[]) => {
    setGenerations(next);
    saveGenerations(next);
  };

  const changeCategories = (next: Category[]) => {
    setCategories(next);
    saveCategories(next);
  };

  const changeDifficulty = (next: Difficulty) => {
    setDifficulty(next);
    saveDifficulty(next);
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

  const start = async (asDaily = false) => {
    if (!identity) return dispatch({ type: 'nick' });
    setStarting(true);
    try {
      const game = await newGame(identity, mode, asDaily, asDaily ? {} : filter);
      if (game === 'unauthorized') {
        // Convidado cujo nick virou conta de outra pessoa, ou token que deixou de valer.
        const reason = identity.token ? t('app.confirmNick') : t('app.nickNowAccount');
        dispatch({ type: 'nick', reason });
      } else if ('error' in game) {
        setSoloError(game.error);
        // Já jogou o desafio (ex: em outra aba): trava o botão.
        if (asDaily && daily) setDaily({ ...daily, done: true });
      } else {
        setSoloError(null);
        if (asDaily) setDaily({ done: true, score: null });
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
      const code = await createParty(mode, pid, filter);
      rememberPartyPid(code, pid);
      dispatch({ type: 'party', code, pid });
    } catch (err) {
      setPartyError(err instanceof Error ? err.message : t('app.roomError'));
    } finally {
      setStarting(false);
    }
  };

  const joinRoom = (code: string) => {
    setPartyError(null);
    dispatch({ type: 'party', code, pid: partyPid(code) });
  };

  const isHome = state.phase === 'intro' || state.phase === 'nick';
  // Barra de perfil (com a navegação) fora da partida: home, loja, conquistas, Arcade e conta. Nelas o Início fica na
  // barra; no resto (partida, party, modo gravação) continua o botão do cabeçalho.
  const navPhase =
    state.phase === 'intro'
      ? ('home' as const)
      : state.phase === 'shop' || state.phase === 'achievements' || state.phase === 'arcade'
        ? state.phase
        : null;
  const showProfileBar =
    Boolean(identity) && !showReview && !recording && (navPhase !== null || state.phase === 'account');
  const eyebrow =
    (state.phase === 'playing' || state.phase === 'result') && state.daily
      ? dailyLabel(t, state.mode, true)
      : state.phase === 'party'
      ? 'Party'
      : state.phase === 'shop'
        ? t('profile.shop')
      : state.phase === 'arcade'
        ? t('profile.arcade')
      : state.phase === 'achievements'
        ? t('ach.title')
      : state.phase === 'account'
        ? t('account.title')
      : modeLabel(t, state.phase === 'playing' || state.phase === 'result' ? state.mode : mode);

  return (
    <main className={`app${recording ? ' recording' : ''}`}>
      {showProfileBar && identity && (
        <ProfileBar
          identity={identity}
          profile={profile}
          current={navPhase}
          onHome={() => dispatch({ type: 'home' })}
          onOpenShop={() => dispatch({ type: 'shop' })}
          onOpenAchievements={() => dispatch({ type: 'achievements' })}
          onOpenArcade={FEATURES.some((f) => features[f]) ? () => dispatch({ type: 'arcade' }) : undefined}
          onOpenAccount={() => dispatch({ type: 'account' })}
          onLeave={leave}
          disabled={starting}
        />
      )}
      <SettingsMenu recording={recording} onRecordingChange={changeRecording} />
      <header className={`app-header${isHome && !showReview ? ' hero' : ''}`}>
        {/* Fora da home, o nome da categoria/modo acima do título (na home, o seletor fica na IntroScreen). */}
        {!isHome && <span className="title-eyebrow">{eyebrow}</span>}
        <h1>
          <span className="title-main">
            Power<em>dle</em>
          </span>
        </h1>
        {!isHome && !showReview && !showProfileBar && (
          <button className="home-button" onClick={() => dispatch({ type: 'home' })}>
            {t('app.home')}
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
      {!showReview && state.phase === 'intro' && !recording && profile && profile.newAchievements.length > 0 && (
        <AchievementUnlocked ids={profile.newAchievements} onClose={dismissAchievements} />
      )}
      {!showReview && state.phase === 'intro' && identity && (
        <IntroScreen
          identity={identity}
          mode={mode}
          onModeChange={changeMode}
          generations={generations}
          onGenerationsChange={changeGenerations}
          difficulty={difficulty}
          onDifficultyChange={changeDifficulty}
          categories={categories}
          onCategoriesChange={changeCategories}
          isModeAvailable={isModeAvailable}
          canDraw={canDraw(mode, filter)}
          busy={starting}
          onSolo={() => start()}
          daily={daily}
          onDaily={() => start(true)}
          onCreateParty={createRoom}
          onJoinParty={joinRoom}
          partyError={partyError}
          soloError={soloError}
        />
      )}
      {state.phase === 'arcade' && identity?.token && profile && (
        <ArcadeScreen
          identity={{ ...identity, token: identity.token }}
          profile={profile}
          features={features}
          onProfileChange={setProfile}
        />
      )}
      {state.phase === 'account' && identity && (
        <AccountScreen
          identity={identity}
          profile={profile}
          onIdentityChange={changeIdentity}
          onRefresh={refreshProfile}
          onLeave={leave}
        />
      )}
      {state.phase === 'achievements' && identity?.token && <AchievementsScreen token={identity.token} />}
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
      {state.phase === 'intro' && !showReview && !recording && (
        <footer className="app-footer">
          {SUPPORT_URL && (
            <>
              <a className="link-button support-link" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                {t('support.button')}
              </a>
              <span aria-hidden="true">·</span>
            </>
          )}
          <LegalLink doc="terms">{t('legal.terms')}</LegalLink>
          <span aria-hidden="true">·</span>
          <LegalLink doc="privacy">{t('legal.privacy')}</LegalLink>
        </footer>
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
          daily={state.daily}
          starting={starting}
          onRestart={() => start()}
        />
      )}
    </main>
  );
}

type CatalogStatus = 'loading' | 'ready' | 'error';

/** Raiz: tradução (idioma escolhido) em volta de tudo. */
export default function App() {
  return (
    <I18nProvider>
      <LegalProvider>
        <CatalogGate />
      </LegalProvider>
    </I18nProvider>
  );
}

/**
 * Carrega o catálogo público de personagens (sem `power`) antes de montar o jogo: o sorteio, os avatares e a
 * loja dependem dele. Sem conexão, mostra a opção de tentar de novo.
 */
function CatalogGate() {
  const { t } = useI18n();
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
          <p className="muted">{t('app.loading')}</p>
        ) : (
          <>
            <p className="error">{t('app.connectError')}</p>
            <button className="btn btn-primary" onClick={load}>
              {t('app.retry')}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
