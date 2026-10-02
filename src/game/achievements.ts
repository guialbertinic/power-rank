/**
 * Conquistas: metas que desbloqueiam um cosmético exclusivo (título ou emblema). Compartilhado entre o servidor
 * (que confere e grava) e o site (lista com progresso). Só contas; sem moedas; sem retroativo (contadores
 * começam do zero em `player_stats`).
 */
import { MODES } from './modes';

/** Contadores de uma conta (tabela `player_stats`). */
export interface AchievementStats {
  /** Partidas que valeram (solo, desafio diário e party; as rápidas demais não contam). */
  games: number;
  /** Maior pontuação numa partida. */
  bestScore: number;
  /** Desafios diários em dias seguidos (qualquer categoria; a sequência de hoje ainda vale até amanhã acabar). */
  dailyStreak: number;
  /** Parties vencidas (1º lugar com 2+ jogadores que terminaram). */
  partyWins: number;
  /** Categorias (modos) com uma partida de 700+. */
  modes700: number;
}

export const EMPTY_STATS: AchievementStats = { games: 0, bestScore: 0, dailyStreak: 0, partyWins: 0, modes700: 0 };

export type AchievementId =
  | 'first-game'
  | 'veteran'
  | 'score-700'
  | 'score-850'
  | 'perfect'
  | 'daily-3'
  | 'daily-7'
  | 'daily-30'
  | 'party-win'
  | 'party-win-5'
  | 'eclectic';

/** Grupo na tela de conquistas (`ach.group.<id>` no i18n). */
export type AchievementGroup = 'games' | 'score' | 'daily' | 'party' | 'categories';

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = ['games', 'score', 'daily', 'party', 'categories'];

export interface Achievement {
  /** Nome e descrição na tela: `ach.<id>.name` e `ach.<id>.desc` (i18n). */
  id: AchievementId;
  group: AchievementGroup;
  /** Contador que mede o progresso. */
  stat: keyof AchievementStats;
  /** Valor do contador que desbloqueia. */
  goal: number;
  /** Cosmético que a conquista dá (id do catálogo, item com `achievement`). */
  reward: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-game', group: 'games', stat: 'games', goal: 1, reward: 'title-recruta' },
  { id: 'veteran', group: 'games', stat: 'games', goal: 100, reward: 'badge-veteran' },
  { id: 'score-700', group: 'score', stat: 'bestScore', goal: 700, reward: 'title-acima-da-media' },
  { id: 'score-850', group: 'score', stat: 'bestScore', goal: 850, reward: 'badge-scouter' },
  { id: 'perfect', group: 'score', stat: 'bestScore', goal: 1000, reward: 'badge-perfect' },
  { id: 'daily-3', group: 'daily', stat: 'dailyStreak', goal: 3, reward: 'title-constante' },
  { id: 'daily-7', group: 'daily', stat: 'dailyStreak', goal: 7, reward: 'badge-streak7' },
  { id: 'daily-30', group: 'daily', stat: 'dailyStreak', goal: 30, reward: 'badge-streak30' },
  { id: 'party-win', group: 'party', stat: 'partyWins', goal: 1, reward: 'title-vencedor-de-party' },
  { id: 'party-win-5', group: 'party', stat: 'partyWins', goal: 5, reward: 'badge-trophy' },
  { id: 'eclectic', group: 'categories', stat: 'modes700', goal: MODES.length, reward: 'badge-eclectic' },
];

/** Pontuação mínima que conta para o "Eclético" (700+ em todas as categorias). */
export const ECLECTIC_MIN_SCORE = 700;

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const BY_REWARD = new Map(ACHIEVEMENTS.map((a) => [a.reward, a]));

export const achievementById = (id: string) => BY_ID.get(id as AchievementId);
/** Conquista que dá o item (para a loja mostrar "Conquista: ..." em vez do preço). */
export const achievementOfReward = (itemId: string) => BY_REWARD.get(itemId);

/** Conquistas que os contadores já alcançam. */
export const reachedAchievements = (stats: AchievementStats) => ACHIEVEMENTS.filter((a) => stats[a.stat] >= a.goal);

/** Progresso exibido (limitado à meta). */
export const achievementProgress = (a: Achievement, stats: AchievementStats) => Math.min(stats[a.stat], a.goal);

/** Situação das conquistas de uma conta (POST /api/achievements). */
export interface AchievementsState {
  stats: AchievementStats;
  /** id da conquista → quando desbloqueou (epoch ms). */
  unlocked: Record<string, number>;
}
