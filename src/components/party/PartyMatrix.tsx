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
 * Todos os palpites de uma vez: uma linha por personagem (na ordem correta) e uma coluna por jogador, com a posição
 * que ele deu na cor do acerto. Tocar no jogador abre a lista dele embaixo.
 */
export default function PartyMatrix({ characters, columns, you, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const picks = columns.map((col) => new Map(col.results.map((r) => [r.character.id, r])));
  const colClass = (p: PartyPlayer) => (p.id === you ? 'is-you' : undefined);

  return (
    <div className="panel">
      <h3 className="section-title">{t('podium.matrix')}</h3>
      <table className="party-matrix">
        <colgroup>
          <col />
          {columns.map(({ player }) => (
            <col key={player.id} className="matrix-col" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
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
              <th scope="row">
                <span className="matrix-char">
                  <span className="matrix-rank">{i + 1}</span>
                  <Avatar character={c} size={28} />
                  <span className="row-name">{c.name}</span>
                </span>
              </th>
              {columns.map(({ player }, j) => {
                const pick = picks[j].get(c.id);
                return (
                  <td key={player.id} className={colClass(player)}>
                    {pick ? <span className={`hit-chip hit-${hitLevel(pick.distance)}`}>{pick.position}</span> : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('podium.points')}</th>
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
