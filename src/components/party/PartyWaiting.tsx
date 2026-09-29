import type { PartyState } from '../../game/party';
import { usePendingClick } from '../../ui/usePendingClick';
import PlayerList from './PlayerList';

interface Props {
  state: PartyState;
  you: string;
  onEnd: () => void;
  onLeave: () => void;
}

/** Depois de terminar: acompanha o progresso de quem ainda está jogando. O dono pode encerrar. */
export default function PartyWaiting({ state, you, onEnd, onLeave }: Props) {
  const [ending, end] = usePendingClick();
  const isHost = state.hostId === you;
  // Você já terminou, mesmo que a confirmação da sala ainda não tenha chegado.
  const stillPlaying = state.players.filter((p) => p.id !== you && p.connected && !p.finished).length;

  return (
    <section className="party party-waiting">
      <div className="panel party-waiting-panel">
        <p className="score-label">Você terminou</p>
        <p className="party-waiting-title">
          {stillPlaying === 1 ? 'Esperando 1 jogador' : `Esperando ${stillPlaying} jogadores`}
        </p>
        <span className="party-spinner" aria-hidden="true" />
      </div>

      <div className="panel">
        <h3 className="section-title">Progresso</h3>
        <PlayerList state={state} you={you} />
      </div>

      <div className="party-actions">
        {isHost && (
          <button className="btn btn-secondary" onClick={() => end(onEnd)} disabled={ending} aria-busy={ending}>
            Encerrar e mostrar pódio
          </button>
        )}
        <button className="link-button" onClick={onLeave}>
          Sair da sala
        </button>
      </div>
    </section>
  );
}
