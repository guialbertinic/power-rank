import { scoreGame, withRanks, type SlotResult } from '../game/scoring';
import type { CharacterInfo } from '../game/types';
import { useI18n } from '../i18n';
import { hitLevel } from '../ui/hits';
import Avatar from './Avatar';
import RankBadge from './RankBadge';

/** Para onde o personagem deveria ir a partir do palpite: ▲ sobe, ▼ desce (com as casas), ✓ acertou. */
function delta(r: SlotResult): string {
  if (r.distance === 0) return '✓';
  return `${r.position > r.correct.max ? '▲' : '▼'}${r.distance}`;
}

/**
 * Uma lista só, na ordem correta, com o palpite do jogador em cada linha (posição que ele deu, na cor do acerto, e
 * o tamanho do erro). Usado no solo e na party (`title` = de quem é o palpite, quando não é o seu).
 * O site não sabe o poder: `ranks` (vindo do servidor no fim da partida) diz quantos são mais fortes que cada um,
 * o que basta para a ordem e as cores de acerto.
 */
export default function RankingComparison({
  slots,
  ranks,
  title,
}: {
  slots: CharacterInfo[];
  ranks: Record<string, number>;
  title?: string;
}) {
  const { t } = useI18n();
  const { results, correctOrder } = scoreGame(withRanks(slots, ranks));
  const byId = new Map(results.map((r) => [r.character.id, r]));

  return (
    <div className="panel result-compare">
      <h3 className="section-title">
        {t('result.correct')}
        <small className="section-hint compare-pick-label">{title ?? t('result.yours')}</small>
      </h3>
      <ol className="row-list">
        {correctOrder.map((c, i) => {
          const r = byId.get(c.id)!;
          return (
            <li key={c.id} className={`row row-compare hit-${hitLevel(r.distance)}`}>
              <RankBadge position={i + 1} small />
              <Avatar character={c} size={32} />
              <span className="row-name">
                {c.name}
                {c.version && <small>{c.version}</small>}
              </span>
              <span className="compare-delta">{delta(r)}</span>
              <span className="hit-chip">{r.position}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
