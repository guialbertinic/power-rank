import characters from '../data/characters.json';
import type { Character } from './game/types';

/** Base de personagens (data/characters.json), usada no sorteio local, nos avatares e na loja. */
export const POOL = characters as Character[];
export const POOL_BY_ID = new Map(POOL.map((c) => [c.id, c]));
