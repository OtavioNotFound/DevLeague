import { describe, expect, it } from 'vitest';
import { firstSignupError, validateSignup } from './signup';

const validInput = {
  email: 'dev@example.com',
  username: 'dev_league',
  password: 'uma-senha-segura',
  passwordConfirmation: 'uma-senha-segura',
  over18: true,
  terms: true
};

describe('RF-AUTH-001 cadastro', () => {
  it('aceita os campos válidos do cadastro', () => {
    expect(validateSignup(validInput)).toEqual({});
  });

  it('valida e prioriza o primeiro campo inválido para foco', () => {
    const errors = validateSignup({ ...validInput, email: 'inválido', username: 'x' });
    expect(errors.email).toBe('Informe um e-mail válido.');
    expect(errors.username).toBe('Use de 3 a 24 letras, números ou underscore.');
    expect(firstSignupError(errors)).toBe('email');
  });

  it('exige senhas coincidentes', () => {
    expect(validateSignup({ ...validInput, passwordConfirmation: 'outra-senha' }).passwordConfirmation)
      .toBe('As senhas não coincidem.');
  });
});

describe('RF-AUTH-003 e RNF-PRIV-006 gate da alpha', () => {
  it('impede avançar sem 18+ e aceites', () => {
    const errors = validateSignup({ ...validInput, over18: false, terms: false });
    expect(errors.over18).toContain('18 anos');
    expect(errors.terms).toContain('Termos');
  });
});
