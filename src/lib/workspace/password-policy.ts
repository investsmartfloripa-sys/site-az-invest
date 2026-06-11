export const PASSWORD_MIN_LENGTH = 8;

/**
 * Política única de senha do workspace.
 * Retorna a mensagem de erro quando a senha viola a política, ou null quando ok
 * (as actions usam redirect com query param para exibir o erro, não exceções).
 */
export function assertPasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}
