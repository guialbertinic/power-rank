import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../api';
import { cosmeticById } from '../game/cosmetics';
import { MODES, type Mode } from '../game/modes';
import { sameNick } from '../nick';
import PlayerTag from './PlayerTag';
import RankBadge from './RankBadge';

interface Props {
  mode: Mode;
  /** Muda para forçar recarregar (ex: depois de enviar uma pontuação). */
  refreshKey?: number;
  highlight?: string;
}

/** Degraus do pódio na ordem visual (2º, 1º, 3º), nas cores dos tiers, como no pódio da party. */
const STEPS = [
  { place: 2, className: 'second tier-s' },
  { place: 1, className: 'first tier-ss' },
  { place: 3, className: 'third tier-a' },
];

/** Top do ranking de um modo (cada categoria tem o seu): os 3 primeiros num pódio, o resto em lista. */
export default function Leaderboard({ mode, refreshKey = 0, highlight }: Props) {
  const [scores, setScores] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScores(null);
    fetchLeaderboard(mode)
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, refreshKey]);

  if (failed) return null;

  const isYou = (s: LeaderboardEntry) => Boolean(highlight && sameNick(s.name, highlight));

  const podiumStep = ({ place, className }: (typeof STEPS)[number]) => {
    const s = scores?.[place - 1];
    if (!s) return <div key={place} className={`podium-step ${className} empty`} />;
    const title = s.look.title ? cosmeticById(s.look.title)?.label : undefined;
    return (
      <div key={place} role="listitem" className={`podium-step ${className}${isYou(s) ? ' you' : ''}`}>
        <PlayerTag name={s.name} look={s.look} size={place === 1 ? 64 : 52} avatarOnly />
        <span className={`podium-name${s.look.nameColor ? ` cosmetic-${s.look.nameColor}` : ''}`}>{s.name}</span>
        {title && <span className="podium-title">{title}</span>}
        <span className="podium-score">{s.score}</span>
        <div className="podium-block">
          <span className="podium-place">{place}º</span>
        </div>
      </div>
    );
  };

  return (
    <div className="panel leaderboard">
      <h3 className="section-title">Ranking · {MODES.find((m) => m.id === mode)?.label}</h3>
      {scores === null && <p className="muted">Carregando...</p>}
      {scores?.length === 0 && <p className="muted">Ninguém jogou ainda. Seja o primeiro.</p>}
      {scores && scores.length > 0 && (
        <>
          <div className="podium leaderboard-podium" role="list" aria-label="Pódio">
            {STEPS.map(podiumStep)}
          </div>
          {scores.length > 3 && (
            <ol className="row-list leaderboard-rows" start={4}>
              {scores.slice(3).map((s, i) => (
                <li key={i} className={`row row-leader${isYou(s) ? ' highlight' : ''}`}>
                  <RankBadge position={i + 4} small />
                  <span className="row-name">
                    <PlayerTag name={s.name} look={s.look} size={36} />
                  </span>
                  <span className="row-score">{s.score}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
