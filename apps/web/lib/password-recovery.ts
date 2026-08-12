export interface PasswordErrors {
  password?: string;
  passwordConfirmation?: string;
}

export function validateRecoveryEmail(email: string): string | undefined {
  return /^\S+@\S+\.\S+$/.test(email) ? undefined : 'Informe um e-mail válido.';
}

export function validateNewPassword(password: string, passwordConfirmation: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (password.length < 8) errors.password = 'Use pelo menos 8 caracteres.';
  if (passwordConfirmation !== password) errors.passwordConfirmation = 'As senhas não coincidem.';
  return errors;
}
