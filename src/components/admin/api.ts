import { request } from '../../api';
import type {
  AdminAction,
  AdminCharacter,
  AdminCharacterDetail,
  AdminFeature,
  AdminPlayer,
  AdminPlayerRow,
  CharacterEdit,
  Economy,
  ReportGroup,
} from '../../game/admin';
import type { Category } from '../../game/types';
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

/** Suspende a conta (`days` null = permanente) ou tira a suspensão. */
export const banPlayer = (id: number, days: number | null, reason: string) =>
  post<AdminPlayer>(`/api/admin/players/${id}/ban`, { days, reason });

export const unbanPlayer = (id: number) => post<AdminPlayer>(`/api/admin/players/${id}/unban`);

export const searchCharacters = (q: string, category: Category | null) =>
  request<AdminCharacter[]>(`/api/admin/characters?${new URLSearchParams({ q, ...(category ? { category } : {}) })}`);

export const fetchCharacter = (id: string) => request<AdminCharacterDetail>(`/api/admin/characters/${id}`);

export const editCharacter = (id: string, edit: CharacterEdit) => post<AdminCharacterDetail>(`/api/admin/characters/${id}`, edit);

/** Envia a imagem nova (WebP em base64, já no tamanho do jogo). */
export const uploadCharacterImage = (id: string, data: string) =>
  post<AdminCharacterDetail>(`/api/admin/characters/${id}/image`, { data });

export const fetchReports = () => request<ReportGroup[]>('/api/admin/reports');

export const closeReports = (group: Pick<ReportGroup, 'kind' | 'target'>, status: 'resolved' | 'dismissed') =>
  post<ReportGroup[]>('/api/admin/reports/close', { kind: group.kind, target: group.target, status });
