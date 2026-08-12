export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

export type SignupField = 'email' | 'username' | 'password' | 'passwordConfirmation' | 'over18' | 'terms';

export interface SignupInput {
  email: string;
  username: string;
  password: string;
  passwordConfirmation: string;
  over18: boolean;
  terms: boolean;
}

export type SignupErrors = Partial<Record<SignupField, string>>;

export function validateSignup(input: SignupInput): SignupErrors {
  const errors: SignupErrors = {};
  if (!/^\S+@\S+\.\S+$/.test(input.email)) errors.email = 'Informe um e-mail válido.';
  if (!USERNAME_PATTERN.test(input.username)) errors.username = 'Use de 3 a 24 letras, números ou underscore.';
  if (input.password.length < 8) errors.password = 'Use pelo menos 8 caracteres.';
  if (input.passwordConfirmation !== input.password) errors.passwordConfirmation = 'As senhas não coincidem.';
  if (!input.over18) errors.over18 = 'A alpha fechada está disponível apenas para participantes com 18 anos ou mais.';
  if (!input.terms) errors.terms = 'Aceite os Termos e o Aviso de Privacidade para continuar.';
  return errors;
}

export function firstSignupError(errors: SignupErrors): SignupField | undefined {
  const order: readonly SignupField[] = ['email', 'username', 'password', 'passwordConfirmation', 'over18', 'terms'];
  return order.find((field) => errors[field]);
}
