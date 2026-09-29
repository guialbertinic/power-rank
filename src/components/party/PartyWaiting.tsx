import type { PartyState } from '../../game/party';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
  const [ending, end] = usePendingClick();
  const isHost = state.hostId === you;
  // Você já terminou, mesmo que a confirmação da sala ainda não tenha chegado.
  const stillPlaying = state.players.filter((p) => p.id !== you && p.connected && !p.finished).length;

  return (
    <section className="party party-waiting">
      <div className="panel party-waiting-panel">
        <p className="score-label">{t('waiting.done')}</p>
        <p className="party-waiting-title">
          {stillPlaying === 1 ? t('waiting.one') : t('waiting.many', { n: stillPlaying })}
        </p>
        <span className="party-spinner" aria-hidden="true" />
      </div>

      <div className="panel">
        <h3 className="section-title">{t('waiting.progress')}</h3>
        <PlayerList state={state} you={you} />
      </div>

      <div className="party-actions">
        {isHost && (
          <button className="btn btn-secondary" onClick={() => end(onEnd)} disabled={ending} aria-busy={ending}>
            {t('waiting.end')}
          </button>
        )}
        <button className="link-button" onClick={onLeave}>
          {t('party.leave')}
        </button>
      </div>
    </section>
  );
}
