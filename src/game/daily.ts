/** Dia do Desafio Diário: horário de Brasília (UTC−3, sem horário de verão). */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia de Brasília como texto (AAAA-MM-DD): chave do Desafio Diário. */
export const dayKey = (now = Date.now()) => new Date(now - BRT_OFFSET_MS).toISOString().slice(0, 10);

/** Quanto falta (ms) para virar o dia de Brasília, quando sai o próximo desafio. */
export const msUntilNextDay = (now = Date.now()) => DAY_MS - ((now - BRT_OFFSET_MS) % DAY_MS);
