export type Category = 'anime' | 'games' | 'pokemon';

/** O que o site sabe de um personagem (catálogo público, GET /api/characters): nunca o `power`. */
export interface CharacterInfo {
  id: string;
  name: string;
  category: Category;
  /** Obra/franquia do personagem (anime ou jogo). */
  series: string;
  /** Fama (anime e games): 1 mainstream, 2 médio, 3 obscuro. Define em que dificuldade o personagem aparece. */
  tier?: 1 | 2 | 3;
  /** Geração do Pokémon (1–9), usada no filtro de gerações. Só na categoria pokemon. */
  generation?: number;
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
  /** Id do Pokémon na PokeAPI (arte oficial), usado por scripts/fetch-images.mjs. */
  pokeapiId?: number;
  /** Nome de busca no AniList/IGDB quando difere de `name` (ex: "Tanjirou Kamado"). */
  search?: string;
}
