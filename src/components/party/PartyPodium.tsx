import { useRef, useState } from 'react';
import { podiumOrder, type PartyPlayer, type PartyState } from '../../game/party';
import { MIN_SCORE_FOR_COINS } from '../../game/economy';
import { MAX_SCORE, rankLevel } from '../../game/scoring';
import { useI18n } from '../../i18n';
import type { CharacterInfo } from '../../game/types';
import Coins from '../Coins';
import PlayerTag from '../PlayerTag';
import RankBadge from '../RankBadge';
import RankingComparison from '../RankingComparison';
import { usePendingClick } from '../../ui/usePendingClick';

interface Props {
  state: PartyState;
  you: string;
  charactersById: Map<string, CharacterInfo>;
  onRestart: () => void;
  onLeave: () => void;
}

/** Degraus do pódio na ordem visual (2º, 1º, 3º), cada um com a cor de um tier: ouro, rosa, ciano. */
const STEPS = [
  { place: 2, className: 'second tier-s' },
  { place: 1, className: 'first tier-ss' },
  { place: 3, className: 'third tier-a' },
];

/**
 * Resultado da rodada: pódio, classificação completa e a comparação de um ranking com o correto. Tocar num jogador
 * da classificação mostra a lista dele no lugar da sua (uma lista por vez, para não lotar a tela).
 */
export default function PartyPodium({ state, you, charactersById, onRestart, onLeave }: Props) {
  const { t } = useI18n();
  const [restarting, restart] = usePendingClick();
  const ranking = podiumOrder(state.players);
  const unfinished = state.players.filter((p) => !p.finished);
  const me = state.players.find((p) => p.id === you);
  // Jogador cuja lista aparece embaixo: você, até escolher outro (quem não terminou não tem lista).
  const [viewingId, setViewingId] = useState(you);
  const viewing = ranking.find((p) => p.id === viewingId) ?? (me?.finished ? me : ranking[0]);
  const viewingSlots = viewing?.placements
    ?.map((id) => charactersById.get(id))
    .filter((c): c is CharacterInfo => Boolean(c));
  const comparisonRef = useRef<HTMLDivElement>(null);
  const view = (id: string) => {
    setViewingId(id);
    // No celular a lista fica bem abaixo da classificação: rola até ela.
    requestAnimationFrame(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const isHost = state.hostId === you;
  const myPlace = ranking.findIndex((p) => p.id === you) + 1;

  const step = (place: number): PartyPlayer | undefined => ranking[place - 1];

  return (
    <section className="party party-podium">
      <div className="podium" role="list" aria-label={t('podium.aria')}>
        {STEPS.map(({ place, className }) => {
          const player = step(place);
          if (!player) return <div key={place} className={`podium-step ${className} empty`} />;
          return (
            <div key={place} role="listitem" className={`podium-step ${className}${player.id === you ? ' you' : ''}`}>
              <PlayerTag name={player.name} look={player.look} size={44} avatarOnly />
              <span className="podium-name">{player.name}</span>
              <span className="podium-score">{player.score}</span>
              <div className="podium-block">
                <span className="podium-place">{t(`podium.place${place as 1 | 2 | 3}`)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3 className="section-title">
          {t('podium.standings', { n: state.round })}
          {ranking.length > 1 && <small className="section-hint">{t('podium.tapToView')}</small>}
        </h3>
        <ol className="row-list">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className={`row row-leader row-selectable${p.id === you ? ' highlight' : ''}${p.id === viewing?.id ? ' selected' : ''}${p.connected ? '' : ' party-player offline'}`}
              role="button"
              tabIndex={0}
              aria-pressed={p.id === viewing?.id}
              onClick={() => view(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  view(p.id);
                }
              }}
            >
              <RankBadge position={i + 1} small />
              <span className="row-name">
                <PlayerTag name={p.name} look={p.look} />
                {!p.connected && <span className="party-tag party-tag-left">{t('podium.left')}</span>}
              </span>
              <span className="row-score">{p.score}</span>
            </li>
          ))}
          {unfinished.map((p) => (
            <li key={p.id} className="row row-leader party-player offline">
              <span className="party-player-index">–</span>
              <span className="row-name">{p.name}</span>
              <span className="party-status">{t('podium.unfinished')}</span>
            </li>
          ))}
        </ol>
      </div>

      {me?.finished && me.score !== undefined && (
        <div className="panel score-panel">
          <p className="score-label">{myPlace ? t('podium.yourPlace', { n: myPlace }) : t('podium.yourScore')}</p>
          <p className="score-value">
            {me.score}
            <span>/{MAX_SCORE}</span>
          </p>
          <p className="title-badge">{t(`rank.${rankLevel(me.score)}`)}</p>
          <p className="coins-earned">
            {me.guest
              ? t('coins.guest')
              : me.coinsEarned
                ? <Coins amount={me.coinsEarned} prefix="+" />
                : t('coins.min', { min: MIN_SCORE_FOR_COINS })}
          </p>
        </div>
      )}

      <div className="party-actions">
        {isHost ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => restart(onRestart)}
            disabled={restarting}
            aria-busy={restarting}
          >
            {t('podium.next')}
          </button>
        ) : (
          <p className="party-waiting-text">{t('podium.waitingHost')}</p>
        )}
        <button className="link-button" onClick={onLeave}>
          {t('party.leave')}
        </button>
      </div>

      {viewing && viewingSlots && viewingSlots.length > 0 && state.ranks && (
        <div ref={comparisonRef} className="party-comparison">
          <RankingComparison
            slots={viewingSlots}
            ranks={state.ranks}
            title={viewing.id === you ? undefined : t('podium.rankingOf', { name: viewing.name })}
          />
        </div>
      )}
    </section>
  );
}
