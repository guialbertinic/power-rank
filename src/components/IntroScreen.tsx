import { useEffect, useState, type FormEvent } from 'react';
import type { DailyStatus } from '../api';
import { msUntilNextDay } from '../game/daily';
import type { Difficulty, Mode } from '../game/modes';
import type { Category } from '../game/types';
import { isPartyCode, normalizePartyCode, PARTY_CODE_LENGTH } from '../game/party';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import CategoryPicker from './CategoryPicker';
import DifficultyPicker from './DifficultyPicker';
import GenerationPicker from './GenerationPicker';
import Leaderboard from './Leaderboard';
import ModePicker from './ModePicker';

type Panel = 'solo' | 'party' | 'daily';

interface Props {
  identity: Identity;
  /** Categoria escolhida; o ranking abaixo acompanha. */
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** Filtro de gerações do modo Pokémon (vale para Solo e para a sala criada; o diário usa todas). */
  generations: number[];
  onGenerationsChange: (generations: number[]) => void;
  /** Dificuldade dos outros modos (vale para Solo e para a sala criada; o diário usa todos). */
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  /** Categorias que entram no Free for All (Solo e sala criada; o diário usa as padrão). */
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
  /** Categorias sem personagens suficientes aparecem como "em breve". */
  isModeAvailable: (mode: Mode) => boolean;
  /** Com a dificuldade/gerações escolhidas há personagens para uma partida. */
  canDraw: boolean;
  /** Algo em andamento (sorteando ou criando sala). */
  busy: boolean;
  onSolo: () => void;
  /** Desafio Diário da categoria para este jogador (null enquanto carrega ou sem conexão: o Jogar espera). */
  daily: DailyStatus | null;
  onDaily: () => void;
  onCreateParty: () => void;
  onJoinParty: (code: string) => void;
  /** Erro ao criar/entrar em sala, vindo do App. */
  partyError: string | null;
  /** Erro ao começar uma partida solo (ex: sem conexão). */
  soloError?: string | null;
}

/**
 * Home: categoria (rótulo "Modo"), as abas SOLO / PARTY / DIÁRIO e o ranking da categoria escolhida no título (o
 * perfil fica na ProfileBar, no canto). Cada aba abre um painel: Solo e Party com a configuração da partida
 * (dificuldade, ou gerações no Pokémon; no Free for All, também as categorias) e o iniciar / criar ou entrar em sala; o Diário com a regra, o status de hoje
 * e o tempo até o próximo.
 */
export default function IntroScreen(props: Props) {
  const { identity, mode, onModeChange, generations, onGenerationsChange, difficulty, onDifficultyChange, categories, onCategoriesChange } = props;
  const { isModeAvailable, canDraw, busy, onSolo, daily, onDaily, onCreateParty, onJoinParty, partyError, soloError } = props;
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<Panel | null>(null);
  const [code, setCode] = useState('');
  const canStart = isModeAvailable(mode);
  const toggle = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));
  // Qual botão disparou o que está em andamento (o spinner aparece só nele).
  const [clicked, setClicked] = useState<'solo' | 'daily' | 'party' | null>(null);

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (isPartyCode(code)) onJoinParty(code);
  };

  return (
    <div className="intro">
      <div className="play-setup">
        <p className="setup-label">{t('mode.category')}</p>
        <ModePicker mode={mode} onChange={onModeChange} isAvailable={isModeAvailable} disabled={busy} />
        <div className="play-buttons">
          <button
            className={`btn btn-lg btn-play-toggle btn-solo${open === 'solo' ? ' active' : ''}`}
            onClick={() => toggle('solo')}
            aria-expanded={open === 'solo'}
            disabled={busy || !canStart}
          >
            Solo
          </button>
          <button
            className={`btn btn-lg btn-play-toggle btn-party${open === 'party' ? ' active' : ''}`}
            onClick={() => toggle('party')}
            aria-expanded={open === 'party'}
            disabled={busy}
          >
            Party
          </button>
          <button
            className={`btn btn-lg btn-play-toggle btn-daily${open === 'daily' ? ' active' : ''}${daily?.done ? ' done' : ''}`}
            onClick={() => toggle('daily')}
            aria-expanded={open === 'daily'}
            disabled={busy || !canStart}
          >
            {t('daily.tab')}
          </button>
        </div>
      </div>
      {soloError && open !== 'solo' && open !== 'daily' && <p className="error">{serverText(soloError, lang)}</p>}

      {open === 'daily' && (
        // Sem configuração: o painel explica a regra e mostra o status de hoje.
        <div className="panel play-panel daily-entry">
          <ul className="daily-rules">
            <li>{t('daily.ruleSame')}</li>
            <li>{t(mode === 'pokemon' ? 'daily.ruleAllGens' : 'daily.ruleAllDiff')}</li>
            <li>{t('daily.ruleOnce')}</li>
          </ul>
          {daily?.done ? (
            <p className="daily-done">
              {daily.score === null ? t('daily.done') : t('daily.doneScore', { score: daily.score })}
            </p>
          ) : (
            // daily null = carregando (ou sem conexão): o botão espera.
            <button
              className="btn btn-lg btn-chamfer btn-daily-play"
              onClick={() => {
                setClicked('daily');
                onDaily();
              }}
              disabled={busy || !canStart || !daily}
              aria-busy={(busy && clicked === 'daily') || !daily}
            >
              {t('daily.play')}
            </button>
          )}
          <DailyCountdown />
          {soloError && <p className="error">{serverText(soloError, lang)}</p>}
        </div>
      )}

      {(open === 'solo' || open === 'party') && (
        <div className={`panel play-panel ${open === 'solo' ? 'solo-entry' : 'party-entry'}`}>
          {/* Configuração de quem inicia ou cria a sala (quem entra por código joga a da sala). */}
          {canStart &&
            (mode === 'pokemon' ? (
              <GenerationPicker generations={generations} onChange={onGenerationsChange} disabled={busy} />
            ) : (
              <>
                {mode === 'all' && <CategoryPicker categories={categories} onChange={onCategoriesChange} disabled={busy} />}
                <DifficultyPicker difficulty={difficulty} onChange={onDifficultyChange} disabled={busy} />
              </>
            ))}
          {open === 'solo' ? (
            <>
              <button
                className="btn btn-primary btn-lg btn-chamfer"
                onClick={() => {
                  setClicked('solo');
                  onSolo();
                }}
                disabled={busy || !canStart || !canDraw}
                aria-busy={busy && clicked === 'solo'}
              >
                {t('intro.start')}
              </button>
              {soloError && <p className="error">{serverText(soloError, lang)}</p>}
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-chamfer"
                onClick={() => {
                  setClicked('party');
                  onCreateParty();
                }}
                disabled={busy || !canStart || !canDraw}
                aria-busy={busy && clicked === 'party'}
              >
                {t('intro.createRoom')}
              </button>
              <span className="party-entry-or">{t('intro.orCode')}</span>
              <form className="party-join" onSubmit={onJoin}>
                <input
                  value={code}
                  onChange={(e) => setCode(normalizePartyCode(e.target.value))}
                  placeholder={t('intro.codePlaceholder')}
                  aria-label={t('intro.codeAria')}
                  maxLength={PARTY_CODE_LENGTH}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
                <button className="btn btn-secondary btn-chamfer" disabled={busy || !isPartyCode(code)}>
                  {t('intro.join')}
                </button>
              </form>
              {partyError && <p className="error">{serverText(partyError, lang)}</p>}
            </>
          )}
        </div>
      )}

      <Leaderboard mode={mode} highlight={identity.name} />
    </div>
  );
}

/** Tempo até o próximo Desafio Diário (meia-noite de Brasília), atualizado a cada 30 s. */
function DailyCountdown() {
  const { t } = useI18n();
  const [left, setLeft] = useState(() => msUntilNextDay());
  useEffect(() => {
    const timer = setInterval(() => setLeft(msUntilNextDay()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.max(1, Math.ceil(left / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
  return <p className="daily-next">{t('daily.next', { time })}</p>;
}
