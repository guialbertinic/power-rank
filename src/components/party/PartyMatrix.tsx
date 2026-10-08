import { useState } from 'react';
import type { PartyPlayer } from '../../game/party';
import type { SlotResult } from '../../game/scoring';
import type { CharacterInfo } from '../../game/types';
import { useI18n } from '../../i18n';
import { hitLevel } from '../../ui/hits';
import Avatar from '../Avatar';
import PlayerTag from '../PlayerTag';

export interface MatrixColumn {
  player: PartyPlayer;
  /** Resultado de cada posição do jogador (de `scoreGame`). */
  results: SlotResult<CharacterInfo & { power: number }>[];
}

interface Props {
  /** Os sorteados na ordem correta (mais forte primeiro). */
  characters: CharacterInfo[];
  /** Um por jogador, na ordem da classificação. */
  columns: MatrixColumn[];
  you: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

/**
 * Todos os palpites de uma vez: uma linha por posição e uma coluna por jogador com o personagem que ele pôs ali
 * (borda na cor do acerto); a primeira coluna é a ordem correta. Tocar num personagem destaca onde cada um o
 * colocou; tocar no jogador abre a lista dele embaixo.
 */
export default function PartyMatrix({ characters, columns, you, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  // Personagem em destaque (o mesmo em todas as colunas).
  const [focusId, setFocusId] = useState<string>();
  const picks = columns.map((col) => new Map(col.results.map((r) => [r.position, r])));
  const colClass = (p: PartyPlayer) => (p.id === you ? 'is-you' : undefined);
  const focusIndex = characters.findIndex((c) => c.id === focusId);
  const focused = characters[focusIndex];

  const pick = (c: CharacterInfo, hit?: number) => (
    <button
      type="button"
      className={`matrix-pick${hit === undefined ? '' : ` hit-${hit}`}${c.id === focusId ? ' is-focus' : ''}`}
      title={c.name}
      aria-label={c.name}
      aria-pressed={c.id === focusId}
      onClick={() => setFocusId(c.id === focusId ? undefined : c.id)}
    >
      <Avatar character={c} />
    </button>
  );

  return (
    <div className="panel">
      <h3 className="section-title">{t('podium.matrix')}</h3>
      <p className="matrix-caption" aria-live="polite">
        {focused ? t('podium.matrixFocus', { name: focused.name, n: focusIndex + 1 }) : t('podium.matrixHint')}
      </p>
      <table className={`party-matrix${focused ? ' has-focus' : ''}`}>
        <colgroup>
          <col className="matrix-rank-col" />
          <col />
          {columns.map(({ player }) => (
            <col key={player.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
            <th scope="col" className="matrix-correct">
              {t('podium.matrixCorrect')}
            </th>
            {columns.map(({ player }) => (
              <th key={player.id} scope="col" className={colClass(player)}>
                <button
                  type="button"
                  className="matrix-player"
                  aria-label={player.name}
                  aria-pressed={player.id === selectedId}
                  onClick={() => onSelect(player.id)}
                >
                  <PlayerTag name={player.name} look={player.look} size={22} avatarOnly />
                  <span className="matrix-player-name">{player.name}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {characters.map((c, i) => (
            <tr key={c.id}>
              <th scope="row" className="matrix-rank">
                {i + 1}
              </th>
              <td className="matrix-correct">{pick(c)}</td>
              {columns.map(({ player }, j) => {
                const result = picks[j].get(i + 1);
                return (
                  <td key={player.id} className={colClass(player)}>
                    {result ? pick(result.character, hitLevel(result.distance)) : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <th scope="row" className="matrix-correct">
              {t('podium.points')}
            </th>
            {columns.map(({ player }) => (
              <td key={player.id} className={colClass(player)}>
                {player.score}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
