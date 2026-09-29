import type { CharacterInfo } from './game/types';

/**
 * Catálogo público de personagens (GET /api/characters): nome, obra, imagem — nunca o `power`, que fica só no
 * servidor. Carregado uma vez na abertura do site (`loadCatalog`); depois disso POOL/POOL_BY_ID estão prontos
 * (o App só mostra as telas quando o catálogo chegou).
 */
export let POOL: CharacterInfo[] = [];
export let POOL_BY_ID = new Map<string, CharacterInfo>();

let loading: Promise<void> | null = null;

export function loadCatalog(): Promise<void> {
  loading ??= fetch('/api/characters')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<CharacterInfo[]>;
    })
    .then((list) => {
      POOL = list;
      POOL_BY_ID = new Map(list.map((c) => [c.id, c]));
    })
    .catch((err) => {
      loading = null; // deixa tentar de novo
      throw err;
    });
  return loading;
}

/** Acrescenta ao catálogo personagens que vieram numa partida (ex: inativo que ainda estava na partida). */
export function rememberCharacters(list: CharacterInfo[]) {
  for (const c of list) {
    if (!POOL_BY_ID.has(c.id)) POOL_BY_ID.set(c.id, c);
  }
}
