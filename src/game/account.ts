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
