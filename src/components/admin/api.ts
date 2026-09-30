import { request } from '../../api';
import type { AdminAction, AdminFeature, AdminPlayer, AdminPlayerRow, Economy } from '../../game/admin';
import type { FeatureId } from '../../game/features';

/** Rotas /api/admin/* (o Cloudflare Access pede o login antes; no dev local, liberado). */

const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const fetchAdminMe = () => request<{ email: string }>('/api/admin/me');

export const fetchFeatures = () => request<AdminFeature[]>('/api/admin/features');

export const setFeature = (id: FeatureId, enabled: boolean) => post<AdminFeature[]>('/api/admin/features', { id, enabled });

export const fetchEconomy = () => request<Economy>('/api/admin/economy');

export const searchPlayers = (q: string, sort: 'recent' | 'coins') =>
  request<AdminPlayerRow[]>(`/api/admin/players?${new URLSearchParams({ q, sort })}`);

export const fetchPlayer = (id: number) => request<AdminPlayer>(`/api/admin/players/${id}`);

export const adjustCoins = (id: number, delta: number, reason: string) =>
  post<AdminPlayer>(`/api/admin/players/${id}/coins`, { delta, reason });

export const renamePlayer = (id: number, name: string) => post<AdminPlayer>(`/api/admin/players/${id}/rename`, { name });

export const resetPassword = (id: number) =>
  post<{ password: string; player: AdminPlayer }>(`/api/admin/players/${id}/password`);

export const fetchActions = () => request<AdminAction[]>('/api/admin/actions');
