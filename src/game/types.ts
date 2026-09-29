export interface Character {
  id: string;
  name: string;
  anime: string;
  /** Qual versão/arco do personagem está sendo considerada. */
  version?: string;
  /** Nível de poder de 0 a 100. Define a resposta correta. */
  power: number;
  /** Caminho relativo a /public, ex: "chars/goku.jpg". */
  image?: string;
  /** Id do personagem no AniList, usado por scripts/fetch-images.mjs. */
  anilistId?: number;
  /** Nome de busca no AniList quando difere de `name` (ex: "Tanjirou Kamado"). */
  search?: string;
}
