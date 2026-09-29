import type { Character } from '../game/types';
import { fallbackBackground, imageUrl, initials } from '../ui/fallback';

/** Card 3:4 do personagem da vez. Não mostra o poder: isso entregaria a resposta. */
export default function PowerCard({ character, badge }: { character: Character; badge: string }) {
  return (
    <div className="power-card-glow">
      <article className="power-card">
        <div className="power-card-inner">
          {character.image ? (
            <img className="power-card-art" src={imageUrl(character.image)} alt="" />
          ) : (
            <div className="power-card-art power-card-fallback" style={{ background: fallbackBackground(character.id) }}>
              {initials(character.name)}
            </div>
          )}
          <span className="power-card-badge">{badge}</span>
          <div className="power-card-info">
            {character.version && <span className="power-card-version">{character.version}</span>}
            <h2 className="power-card-name">{character.name}</h2>
            <p className="power-card-anime">{character.anime}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
