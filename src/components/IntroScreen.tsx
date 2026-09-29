import { useState, type FormEvent } from 'react';
import type { Mode } from '../game/modes';
import { isPartyCode, normalizePartyCode, PARTY_CODE_LENGTH } from '../game/party';
import { NICK_MAX_LENGTH } from '../nick';
import Leaderboard from './Leaderboard';

interface Props {
  nick: string;
  onNickChange: (nick: string) => void;
  /** Categoria escolhida no seletor do título; o ranking abaixo acompanha. */
  mode: Mode;
  canStart: boolean;
  /** Algo em andamento (sorteando ou criando sala). */
  busy: boolean;
  onSolo: () => void;
  onCreateParty: () => void;
  onJoinParty: (code: string) => void;
  /** Erro ao criar/entrar em sala, vindo do App. */
  partyError: string | null;
  /** Código de um link de convite (?sala=...): abre o painel da party já preenchido. */
  inviteCode: string;
}

export default function IntroScreen(props: Props) {
  const { nick, onNickChange, mode, canStart, busy, onSolo, onCreateParty, onJoinParty, partyError, inviteCode } = props;
  const [partyOpen, setPartyOpen] = useState(Boolean(inviteCode));
  const [code, setCode] = useState(inviteCode);
  const hasNick = Boolean(nick.trim());

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (hasNick && canStart) onSolo();
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (hasNick && isPartyCode(code)) onJoinParty(code);
  };

  return (
    <div className="intro">
      <form className="nick-form" onSubmit={onSubmit}>
        <label className="nick-label" htmlFor="nick">
          Seu nick
        </label>
        <input
          id="nick"
          value={nick}
          onChange={(e) => onNickChange(e.target.value)}
          maxLength={NICK_MAX_LENGTH}
          autoComplete="nickname"
          spellCheck={false}
          disabled={busy}
        />
        <div className="play-buttons">
          <button className="btn btn-primary btn-lg" disabled={busy || !hasNick || !canStart}>
            {busy && !partyOpen ? 'Sorteando...' : 'Solo'}
          </button>
          <button
            type="button"
            className={`btn btn-lg btn-party${partyOpen ? ' active' : ''}`}
            onClick={() => setPartyOpen((open) => !open)}
            aria-expanded={partyOpen}
            disabled={busy}
          >
            Party
          </button>
        </div>
      </form>

      {partyOpen && (
        <div className="panel party-entry">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCreateParty}
            disabled={busy || !hasNick || !canStart}
          >
            {busy ? 'Criando...' : 'Criar sala'}
          </button>
          <span className="party-entry-or">ou</span>
          <form className="party-join" onSubmit={onJoin}>
            <input
              value={code}
              onChange={(e) => setCode(normalizePartyCode(e.target.value))}
              placeholder="CÓDIGO"
              aria-label="Código da sala"
              maxLength={PARTY_CODE_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
            <button className="btn btn-secondary" disabled={busy || !hasNick || !isPartyCode(code)}>
              Entrar
            </button>
          </form>
          {!hasNick && <p className="muted party-entry-hint">Escolha um nick para jogar em party.</p>}
          {partyError && <p className="error">{partyError}</p>}
        </div>
      )}

      <Leaderboard mode={mode} highlight={nick} />
    </div>
  );
}
