import { json, type Env } from './lib';
import { isFeatureId, NO_FEATURES, type FeatureId, type Features } from '../src/game/features';

/** Estado de todas as chaves (sem linha no banco = desligada). */
export async function loadFeatures(env: Env): Promise<Features> {
  const rows = await env.DB.prepare('SELECT id, enabled FROM features').all<{ id: string; enabled: number }>();
  const features = { ...NO_FEATURES };
  for (const row of rows.results) if (isFeatureId(row.id)) features[row.id] = Boolean(row.enabled);
  return features;
}

/** 403 se a chave estiver desligada; null se pode seguir. */
export async function requireFeature(env: Env, id: FeatureId): Promise<Response | null> {
  const row = await env.DB.prepare('SELECT enabled FROM features WHERE id = ?').bind(id).first<{ enabled: number }>();
  if (row?.enabled) return null;
  return json({ error: 'Este minigame está desligado no momento.', code: 'feature_disabled' }, { status: 403 });
}
