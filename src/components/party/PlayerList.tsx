import { useState } from 'react';
import { SLOTS } from '../../game/scoring';
import type { PartyPlayer, PartyState } from '../../game/party';
import { useI18n, type Key } from '../../i18n';
import PlayerTag from '../PlayerTag';

/** Situação do jogador durante a partida. */
function status(player: PartyPlayer, phase: PartyState['phase'], t: (key: Key) => string): string | null {
  if (!player.connected) return t('party.disconnected');
  if (phase !== 'playing') return null;
  return player.finished ? t('party.finished') : `${player.progress}/${SLOTS}`;
}

interface Props {
  state: PartyState;
  you: string;
  /** Só para o dono: tirar o jogador da sala e passar a dona. */
  onKick?: (id: string) => void;
  onMakeHost?: (id: string) => void;
}

/**
 * Lista de jogadores da sala, com dono, "você" e, durante a partida, o progresso de cada um. O dono abre as ações
 * de um jogador ("⋯") para passar a dona ou expulsar; abrir já serve de confirmação.
 */
export default function PlayerList({ state, you, onKick, onMakeHost }: Props) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const canManage = state.hostId === you && Boolean(onKick && onMakeHost);
  return (
    <ol className="row-list party-players">
      {state.players.map((p, i) => {
        const label = status(p, state.phase, t);
        const open = canManage && openId === p.id;
        return (
          <li
            key={p.id}
            className={`row party-player${p.connected ? '' : ' offline'}${p.id === you ? ' you' : ''}${p.finished ? ' done' : ''}${open ? ' open' : ''}`}
          >
            <span className="party-player-index">{i + 1}</span>
            <span className="row-name">
              <PlayerTag name={p.name} look={p.look} />
              {p.id === state.hostId && <span className="party-tag">{t('party.host')}</span>}
              {p.id === you && <span className="party-tag party-tag-you">{t('party.you')}</span>}
            </span>
            {state.phase === 'playing' && p.connected && (
              <span className="party-progress" aria-hidden="true">
                {Array.from({ length: SLOTS }, (_, s) => (
                  <span key={s} className={s < p.progress ? 'seg on' : 'seg'} />
                ))}
              </span>
            )}
            {label && <span className="party-status">{label}</span>}
            {canManage && p.id !== you && (
              <button
                className="party-player-menu"
                aria-expanded={open}
                aria-label={t('party.manage', { name: p.name })}
                onClick={() => setOpenId(open ? null : p.id)}
              >
                ⋯
              </button>
            )}
            {open && (
              <span className="party-player-actions">
                {p.connected && (
                  <button
                    className="party-action"
                    onClick={() => {
                      setOpenId(null);
                      onMakeHost!(p.id);
                    }}
                  >
                    {t('party.makeHost')}
                  </button>
                )}
                <button
                  className="party-action party-action-danger"
                  onClick={() => {
                    setOpenId(null);
                    onKick!(p.id);
                  }}
                >
                  {t('party.kick')}
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
