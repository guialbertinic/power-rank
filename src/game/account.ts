/** Regras da senha do nick, iguais no cliente e no servidor. */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;

/** Mensagem de erro se a senha não puder ser usada, ou null se estiver ok. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha pode ter até ${PASSWORD_MAX_LENGTH} caracteres`;
  return null;
}

/** `players.banned_until` de uma suspensão permanente (bem depois de qualquer data real). */
export const BAN_FOREVER = 8_000_000_000_000_000;
/** Suspensões temporárias que o admin oferece, em dias (além da permanente). */
export const BAN_DAYS = [1, 7, 30] as const;

/** Mensagem (em português, traduzida no site) para quem tenta entrar numa conta suspensa. */
export function banMessage(bannedUntil: number): string {
  if (bannedUntil >= BAN_FOREVER) return 'Esta conta foi suspensa.';
  // Data de Brasília (UTC−3), como o resto do jogo.
  const [y, m, d] = new Date(bannedUntil - 3 * 60 * 60 * 1000).toISOString().slice(0, 10).split('-');
  return `Esta conta está suspensa até ${d}/${m}/${y}.`;
}
