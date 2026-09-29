import { podiumOrder, type PartyPlayer, type PartyState } from '../../game/party';
import { MAX_SCORE, rankTitle } from '../../game/scoring';
import type { Character } from '../../game/types';
import RankBadge from '../RankBadge';
import RankingComparison from '../RankingComparison';

interface Props {
  state: PartyState;
  you: string;
  charactersById: Map<string, Character>;
  onRestart: () => void;
  onLeave: () => void;
}

/** Degraus do pódio na ordem visual (2º, 1º, 3º), cada um com a cor de um tier: ouro, rosa, ciano. */
const STEPS = [
  { place: 2, className: 'second tier-s' },
  { place: 1, className: 'first tier-ss' },
  { place: 3, className: 'third tier-a' },
];

/** Resultado da rodada: pódio, classificação completa e a comparação do próprio ranking. */
export default function PartyPodium({ state, you, charactersById, onRestart, onLeave }: Props) {
  const ranking = podiumOrder(state.players);
  const unfinished = state.players.filter((p) => !p.finished);
  const me = state.players.find((p) => p.id === you);
  const mySlots = me?.placements?.map((id) => charactersById.get(id)).filter((c): c is Character => Boolean(c));
  const isHost = state.hostId === you;
  const myPlace = ranking.findIndex((p) => p.id === you) + 1;

  const step = (place: number): PartyPlayer | undefined => ranking[place - 1];

  return (
    <section className="party party-podium">
      <div className="podium" role="list" aria-label="Pódio">
        {STEPS.map(({ place, className }) => {
          const player = step(place);
          if (!player) return <div key={place} className={`podium-step ${className} empty`} />;
          return (
            <div key={place} role="listitem" className={`podium-step ${className}${player.id === you ? ' you' : ''}`}>
              <span className="podium-name">{player.name}</span>
              <span className="podium-score">{player.score}</span>
              <div className="podium-block">
                <span className="podium-place">{place}º</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3 className="section-title">Classificação · rodada {state.round}</h3>
        <ol className="row-list">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className={`row row-leader${p.id === you ? ' highlight' : ''}${p.connected ? '' : ' party-player offline'}`}
            >
              <RankBadge position={i + 1} small />
              <span className="row-name">
                {p.name}
                {!p.connected && <span className="party-tag party-tag-left">saiu</span>}
              </span>
              <span className="row-score">{p.score}</span>
            </li>
          ))}
          {unfinished.map((p) => (
            <li key={p.id} className="row row-leader party-player offline">
              <span className="party-player-index">–</span>
              <span className="row-name">{p.name}</span>
              <span className="party-status">não terminou</span>
            </li>
          ))}
        </ol>
      </div>

      {me?.finished && me.score !== undefined && (
        <div className="panel score-panel">
          <p className="score-label">{myPlace ? `Você ficou em ${myPlace}º` : 'Sua pontuação'}</p>
          <p className="score-value">
            {me.score}
            <span>/{MAX_SCORE}</span>
          </p>
          <p className="title-badge">{rankTitle(me.score)}</p>
        </div>
      )}

      <div className="party-actions">
        {isHost ? (
          <button className="btn btn-primary btn-lg" onClick={onRestart}>
            Nova partida
          </button>
        ) : (
          <p className="party-waiting-text">Aguardando o dono iniciar a próxima...</p>
        )}
        <button className="link-button" onClick={onLeave}>
          Sair da sala
        </button>
      </div>

      {mySlots && mySlots.length > 0 && <RankingComparison slots={mySlots} />}
    </section>
  );
}
