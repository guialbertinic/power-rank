/**
 * Chaves (feature flags) guardadas no D1 (tabela `features`): ligam e desligam partes do jogo sem deploy.
 * Uma chave por minigame do Arcade e por jogo da seção "Mais jogos". Sem linha no banco = desligado.
 */
export const FEATURES = ['slots', 'plinko', 'scratch', 'mystery_box', 'autobattle'] as const;

export type FeatureId = (typeof FEATURES)[number];

export type Features = Record<FeatureId, boolean>;

/** Tudo desligado: enquanto carrega, sem conexão ou sem a tabela. */
export const NO_FEATURES: Features = { slots: false, plinko: false, scratch: false, mystery_box: false, autobattle: false };

/** Minigames com moedas (tela do Arcade, 18+). */
export const ARCADE_FEATURES = ['slots', 'plinko', 'scratch', 'mystery_box'] as const satisfies readonly FeatureId[];
/** Jogos da seção "Mais jogos" (fora do ranking de poder). */
export const EXTRA_FEATURES = ['autobattle'] as const satisfies readonly FeatureId[];

export const isFeatureId = (id: unknown): id is FeatureId => FEATURES.includes(id as FeatureId);
