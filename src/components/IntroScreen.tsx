import { useState, type FormEvent } from 'react';
import type { DailyStatus } from '../api';
import type { Mode } from '../game/modes';
import { isPartyCode, normalizePartyCode, PARTY_CODE_LENGTH } from '../game/party';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import Leaderboard from './Leaderboard';
import ModePicker from './ModePicker';

interface Props {
  identity: Identity;
  /** Categoria escolhida; o ranking abaixo acompanha. */
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** Categorias sem personagens suficientes aparecem como "em breve". */
  isModeAvailable: (mode: Mode) => boolean;
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

/** Home: categoria (rótulo "Modo"), SOLO / PARTY, o Desafio Diário e o ranking da categoria escolhida no título (o perfil fica na ProfileBar, no canto). */
export default function IntroScreen(props: Props) {
  const { identity, mode, onModeChange, isModeAvailable, busy, onSolo, daily, onDaily, onCreateParty, onJoinParty, partyError, soloError } = props;
  const { t, lang } = useI18n();
  const [partyOpen, setPartyOpen] = useState(false);
  const [code, setCode] = useState('');
  const canStart = isModeAvailable(mode);

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
            className="btn btn-primary btn-lg"
            onClick={onSolo}
            disabled={busy || !canStart}
            aria-busy={busy && !partyOpen}
          >
            Solo
          </button>
          <button
            className={`btn btn-lg btn-party${partyOpen ? ' active' : ''}`}
            onClick={() => setPartyOpen((open) => !open)}
            aria-expanded={partyOpen}
            disabled={busy}
          >
            Party
          </button>
        </div>
        {daily && (
          // Uma tentativa por dia e categoria: depois de jogar, o botão trava e mostra a pontuação.
          <button className="btn btn-lg btn-daily" onClick={onDaily} disabled={busy || !canStart || daily.done} aria-busy={busy && !partyOpen}>
            {daily.done
              ? daily.score === null
                ? t('daily.done')
                : t('daily.doneScore', { score: daily.score })
              : t('daily.label')}
          </button>
        )}
      </div>
      {soloError && <p className="error">{serverText(soloError, lang)}</p>}

      {partyOpen && (
        <div className="panel party-entry">
          <button className="btn btn-secondary" onClick={onCreateParty} disabled={busy || !canStart} aria-busy={busy}>
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
        </div>
      )}

      <Leaderboard mode={mode} highlight={identity.name} />
    </div>
  );
}
