import { useState } from 'react';
import { MODES } from '../../game/modes';
import { PARTY_MAX_PLAYERS, type PartyState } from '../../game/party';
import { inviteLink } from '../../party/session';
import { usePendingClick } from '../../ui/usePendingClick';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [starting, start] = usePendingClick();
  const isHost = state.hostId === you;
  const label = MODES.find((m) => m.id === state.mode)?.label ?? '';
  // Filtro da sala: gerações (Pokémon) ou dificuldade (os outros modos).
  const filter = state.generations
    ? t('gen.short', { list: state.generations.join(', ') })
    : state.difficulty
      ? t(`diff.${state.difficulty}`)
      : null;
  const mode = filter ? `${label} · ${filter}` : label;

  const onCopy = async (what: 'code' | 'link') => {
    if (await copy(what === 'code' ? state.code : inviteLink(state.code))) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <section className="party party-lobby">
      <div className="panel party-code-panel">
        <p className="score-label">{t('lobby.code', { mode })}</p>
        <p className="party-code" aria-label={t('lobby.codeAria', { code: state.code.split('').join(' ') })}>
          {state.code}
        </p>
        <div className="party-code-actions">
          <button className="link-button" onClick={() => onCopy('code')}>
            {copied === 'code' ? t('common.copied') : t('lobby.copyCode')}
          </button>
          <button className="link-button" onClick={() => onCopy('link')}>
            {copied === 'link' ? t('common.copied') : t('lobby.copyLink')}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 className="section-title">
          {t('lobby.players', { n: state.players.length, max: PARTY_MAX_PLAYERS })}
        </h3>
        <PlayerList state={state} you={you} />
      </div>

      <div className="party-actions">
        {isHost ? (
          <button className="btn btn-primary btn-lg" onClick={() => start(onStart)} disabled={starting} aria-busy={starting}>
            {t('lobby.start')}
          </button>
        ) : (
          <p className="party-waiting-text">{t('lobby.waitingHost')}</p>
        )}
        <button className="link-button" onClick={onLeave}>
          {t('party.leave')}
        </button>
      </div>
    </section>
  );
}
