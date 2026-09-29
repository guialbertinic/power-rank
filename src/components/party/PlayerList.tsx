import { SLOTS } from '../../game/scoring';
import type { PartyPlayer, PartyState } from '../../game/party';
import PlayerTag from '../PlayerTag';

/** Situação do jogador durante a partida. */
function status(player: PartyPlayer, phase: PartyState['phase']): string | null {
  if (!player.connected) return 'desconectado';
  if (phase !== 'playing') return null;
  return player.finished ? 'terminou' : `${player.progress}/${SLOTS}`;
}

/** Lista de jogadores da sala, com dono, "você" e, durante a partida, o progresso de cada um. */
export default function PlayerList({ state, you }: { state: PartyState; you: string }) {
  return (
    <ol className="row-list party-players">
      {state.players.map((p, i) => {
        const label = status(p, state.phase);
        return (
          <li
            key={p.id}
            className={`row party-player${p.connected ? '' : ' offline'}${p.id === you ? ' you' : ''}${p.finished ? ' done' : ''}`}
          >
            <span className="party-player-index">{i + 1}</span>
            <span className="row-name">
              <PlayerTag name={p.name} look={p.look} />
              {p.id === state.hostId && <span className="party-tag">dono</span>}
              {p.id === you && <span className="party-tag party-tag-you">você</span>}
            </span>
            {state.phase === 'playing' && p.connected && (
              <span className="party-progress" aria-hidden="true">
                {Array.from({ length: SLOTS }, (_, s) => (
                  <span key={s} className={s < p.progress ? 'seg on' : 'seg'} />
                ))}
              </span>
            )}
            {label && <span className="party-status">{label}</span>}
          </li>
        );
      })}
    </ol>
  );
}
