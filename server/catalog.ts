import { json, type Env } from './lib';
import type { Character, CharacterInfo } from '../src/game/types';

/**
 * Catálogo de personagens, lido da tabela `characters` (sincronizada de data/characters.json).
 * Fica em memória no isolate por alguns minutos: o sorteio e a pontuação não consultam o banco inteiro a cada
 * partida. Depois de um `characters:sync`, o catálogo novo vale em até CACHE_MS.
 */
const CACHE_MS = 5 * 60 * 1000;

export interface Catalog {
  /** Personagens ativos (sorteáveis e à venda como avatar se tiverem imagem). */
  active: Character[];
  /** Todos, inclusive inativos: partidas e avatares antigos continuam resolvendo o personagem. */
  byId: Map<string, Character>;
}

interface Row {
  id: string;
  name: string;
  category: Character['category'];
  series: string;
  version: string | null;
  power: number;
  image: string | null;
  anilist_id: number | null;
  image_version: string | null;
  active: number;
}

let cache: { at: number; catalog: Catalog } | null = null;

export async function loadCatalog(env: Env): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.catalog;
  const { results } = await env.DB.prepare(
    'SELECT id, name, category, series, version, power, image, anilist_id, image_version, active FROM characters',
  ).all<Row>();
  const all = results.map((r) => ({
    character: {
      id: r.id,
      name: r.name,
      category: r.category,
      series: r.series,
      power: r.power,
      ...(r.version ? { version: r.version } : {}),
      ...(r.image ? { image: r.image } : {}),
      ...(r.anilist_id !== null ? { anilistId: r.anilist_id } : {}),
      ...(r.image_version ? { imageVersion: r.image_version } : {}),
    } satisfies Character,
    active: r.active === 1,
  }));
  const catalog: Catalog = {
    active: all.filter((a) => a.active).map((a) => a.character),
    byId: new Map(all.map((a) => [a.character.id, a.character])),
  };
  cache = { at: Date.now(), catalog };
  return catalog;
}

/** O que o site pode saber de um personagem: tudo menos o `power`. */
export function publicInfo({ power: _power, ...info }: Character): CharacterInfo {
  return info;
}

/** GET /api/characters → CharacterInfo[] (ativos). Sem `power`; pode ficar em cache no navegador por 5 min. */
export async function getCharacters(env: Env): Promise<Response> {
  const { active } = await loadCatalog(env);
  // Ordem alfabética: a ordem do banco/JSON segue o power e entregaria o ranking mesmo sem o número.
  const list = active.map(publicInfo).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return json(list, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

/** A rota de dev só responde no servidor local (npm run dev): em produção o host nunca é localhost. */
export const isLocalRequest = (request: Request) => ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);

/** GET /api/dev/characters → Character[] com `power`, só no dev local (tela /?review). */
export async function getCharactersWithPower(request: Request, env: Env): Promise<Response> {
  if (!isLocalRequest(request)) return json({ error: 'Not found' }, { status: 404 });
  const { active } = await loadCatalog(env);
  return json(active);
}
