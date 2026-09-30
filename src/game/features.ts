/**
 * Chaves (feature flags) guardadas no D1 (tabela `features`): ligam e desligam partes do jogo sem deploy.
 * Hoje, um minigame do Arcade por chave. Sem linha no banco = desligado.
 */
export const FEATURES = ['slots', 'plinko', 'mystery_box'] as const;

export type FeatureId = (typeof FEATURES)[number];

export type Features = Record<FeatureId, boolean>;

/** Tudo desligado: enquanto carrega, sem conexão ou sem a tabela. */
export const NO_FEATURES: Features = { slots: false, plinko: false, mystery_box: false };

export const isFeatureId = (id: unknown): id is FeatureId => FEATURES.includes(id as FeatureId);
