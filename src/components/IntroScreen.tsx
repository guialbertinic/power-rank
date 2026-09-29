import { useState, type FormEvent } from 'react';
import type { Mode } from '../game/modes';
import { isPartyCode, normalizePartyCode, PARTY_CODE_LENGTH } from '../game/party';
import type { Identity } from '../nick';
import Leaderboard from './Leaderboard';

interface Props {
  identity: Identity;
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
}

/** Home: SOLO / PARTY e o ranking da categoria escolhida no título (o perfil fica na ProfileBar, no canto). */
export default function IntroScreen(props: Props) {
  const { identity, mode, canStart, busy, onSolo, onCreateParty, onJoinParty, partyError } = props;
  const [partyOpen, setPartyOpen] = useState(false);
  const [code, setCode] = useState('');

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (isPartyCode(code)) onJoinParty(code);
  };

  return (
    <div className="intro">
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

      {partyOpen && (
        <div className="panel party-entry">
          <button className="btn btn-secondary" onClick={onCreateParty} disabled={busy || !canStart} aria-busy={busy}>
            Criar sala
          </button>
          <span className="party-entry-or">ou entre com o código</span>
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
            <button className="btn btn-secondary" disabled={busy || !isPartyCode(code)}>
              Entrar
            </button>
          </form>
          {partyError && <p className="error">{partyError}</p>}
        </div>
      )}

      <Leaderboard mode={mode} highlight={identity.name} />
    </div>
  );
}
