import { MAX_SCORE, POINTS_BY_DISTANCE, SLOTS } from '../game/scoring';
import Leaderboard from './Leaderboard';

interface Props {
  poolSize: number;
  starting: boolean;
  onStart: () => void;
}

export default function IntroScreen({ poolSize, starting, onStart }: Props) {
  return (
    <div className="intro-layout">
      <section className="panel intro">
        <p className="lead">
          {SLOTS} personagens serão sorteados entre {poolSize}. Eles aparecem <strong>um de cada vez</strong>, e
          você precisa colocar cada um em uma posição de 1 (mais forte) a {SLOTS} (mais fraco).
        </p>
        <p>Depois de colocado, não dá pra mudar. Você não sabe quem vem a seguir!</p>
        <ul className="rules">
          {POINTS_BY_DISTANCE.map((points, distance) => (
            <li key={distance}>
              {distance === 0 ? 'Posição exata' : `Errou por ${distance}`}: <strong>{points} pts</strong>
            </li>
          ))}
          <li>
            Pontuação máxima: <strong>{MAX_SCORE}</strong>
          </li>
        </ul>
        <button className="btn-primary" onClick={onStart} disabled={starting} autoFocus>
          {starting ? 'Sorteando...' : 'Começar'}
        </button>
      </section>
      <Leaderboard />
    </div>
  );
}
