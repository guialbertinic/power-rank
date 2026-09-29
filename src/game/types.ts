export type Category = 'anime' | 'games';

/** O que o site sabe de um personagem (catálogo público, GET /api/characters): nunca o `power`. */
export interface CharacterInfo {
  id: string;
  name: string;
  category: Category;
  /** Obra/franquia do personagem (anime ou jogo). */
  series: string;
  /** Qual versão/arco do personagem está sendo considerada. */
  version?: string;
  /** Caminho relativo a /public, ex: "chars/goku.webp". */
  image?: string;
  /** Id do personagem no AniList (usado no ?v= da imagem e por scripts/fetch-images.mjs). */
  anilistId?: number;
  /** Versão da imagem importada manualmente (scripts/import-image.mjs), usada para invalidar o cache. */
  imageVersion?: string;
}

/** Personagem completo: só no servidor (banco) e em data/characters.json. */
export interface Character extends CharacterInfo {
  /** Nível de poder de 0 a 100. Define a resposta correta. */
  power: number;
  /** Id do personagem no IGDB (games), usado por scripts/fetch-images.mjs. */
  igdbId?: number;
  /** Título do artigo da Wikipédia (inglês) com a imagem (games sem retrato no IGDB). */
  wikipedia?: string;
  /** Nome de busca no AniList/IGDB quando difere de `name` (ex: "Tanjirou Kamado"). */
  search?: string;
}
