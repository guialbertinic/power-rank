import { useState, type FormEvent } from 'react';
import type { DailyStatus } from '../api';
import type { Difficulty, Mode } from '../game/modes';
import { isPartyCode, normalizePartyCode, PARTY_CODE_LENGTH } from '../game/party';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import DifficultyPicker from './DifficultyPicker';
import GenerationPicker from './GenerationPicker';
import Leaderboard from './Leaderboard';
import ModePicker from './ModePicker';

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
  /** Categorias sem personagens suficientes aparecem como "em breve". */
  isModeAvailable: (mode: Mode) => boolean;
  /** Com a dificuldade/gerações escolhidas há personagens para uma partida. */
  canDraw: boolean;
  /** Algo em andamento (sorteando ou criando sala). */
  busy: boolean;
  onSolo: () => void;
  /** Desafio Diário da categoria para este jogador (null enquanto carrega ou sem conexão: o botão não aparece). */
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
 * Home: categoria (rótulo "Modo"), SOLO / PARTY, o Desafio Diário e o ranking da categoria escolhida no título (o
 * perfil fica na ProfileBar, no canto). Solo e Party abrem um painel com a configuração da partida (dificuldade, ou
 * gerações no Pokémon) e o botão de iniciar / criar ou entrar em sala.
 */
export default function IntroScreen(props: Props) {
  const { identity, mode, onModeChange, generations, onGenerationsChange, difficulty, onDifficultyChange } = props;
  const { isModeAvailable, canDraw, busy, onSolo, daily, onDaily, onCreateParty, onJoinParty, partyError, soloError } = props;
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<'solo' | 'party' | null>(null);
  const [code, setCode] = useState('');
  const canStart = isModeAvailable(mode);
  const toggle = (panel: 'solo' | 'party') => setOpen((current) => (current === panel ? null : panel));
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
        </div>
        {daily && (
          // Uma tentativa por dia e categoria: depois de jogar, o botão trava e mostra a pontuação.
          <button
            className="btn btn-lg btn-daily"
            onClick={() => {
              setClicked('daily');
              onDaily();
            }}
            disabled={busy || !canStart || daily.done}
            aria-busy={busy && clicked === 'daily'}
          >
            {daily.done
              ? daily.score === null
                ? t('daily.done')
                : t('daily.doneScore', { score: daily.score })
              : t('daily.label')}
          </button>
        )}
      </div>
      {soloError && open !== 'solo' && <p className="error">{serverText(soloError, lang)}</p>}

      {open && (
        <div className={`panel play-panel ${open === 'solo' ? 'solo-entry' : 'party-entry'}`}>
          {/* Configuração de quem inicia ou cria a sala (quem entra por código joga a da sala). */}
          {canStart &&
            (mode === 'pokemon' ? (
              <GenerationPicker generations={generations} onChange={onGenerationsChange} disabled={busy} />
            ) : (
              <DifficultyPicker difficulty={difficulty} onChange={onDifficultyChange} disabled={busy} />
            ))}
          {open === 'solo' ? (
            <>
              <button
                className="btn btn-primary btn-lg"
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
                className="btn btn-secondary"
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
                <button className="btn btn-secondary" disabled={busy || !isPartyCode(code)}>
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
