import { useState } from 'react';
import { MODES } from '../../game/modes';
import { PARTY_MAX_PLAYERS, type PartyState } from '../../game/party';
import { inviteLink } from '../../party/session';
import PlayerList from './PlayerList';

interface Props {
  state: PartyState;
  you: string;
  onStart: () => void;
  onLeave: () => void;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Sala antes da partida: código para convidar, quem já entrou e o botão de iniciar (só o dono). */
export default function PartyLobby({ state, you, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isHost = state.hostId === you;
  const mode = MODES.find((m) => m.id === state.mode)?.label;

  const onCopy = async (what: 'code' | 'link') => {
    if (await copy(what === 'code' ? state.code : inviteLink(state.code))) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <section className="party party-lobby">
      <div className="panel party-code-panel">
        <p className="score-label">Código da sala · {mode}</p>
        <p className="party-code" aria-label={`Código ${state.code.split('').join(' ')}`}>
          {state.code}
        </p>
        <div className="party-code-actions">
          <button className="link-button" onClick={() => onCopy('code')}>
            {copied === 'code' ? 'Copiado!' : 'Copiar código'}
          </button>
          <button className="link-button" onClick={() => onCopy('link')}>
            {copied === 'link' ? 'Copiado!' : 'Copiar link de convite'}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 className="section-title">
          Jogadores · {state.players.length}/{PARTY_MAX_PLAYERS}
        </h3>
        <PlayerList state={state} you={you} />
      </div>

      <div className="party-actions">
        {isHost ? (
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Iniciar partida
          </button>
        ) : (
          <p className="party-waiting-text">Aguardando o dono da sala iniciar...</p>
        )}
        <button className="link-button" onClick={onLeave}>
          Sair da sala
        </button>
      </div>
    </section>
  );
}
