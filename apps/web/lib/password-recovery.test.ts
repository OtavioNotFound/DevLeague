import { describe, expect, it } from 'vitest';
import { validateNewPassword, validateRecoveryEmail } from './password-recovery';

describe('RF-AUTH-002 recuperação de acesso', () => {
  it('valida o e-mail antes de solicitar a recuperação', () => {
    expect(validateRecoveryEmail('dev@example.com')).toBeUndefined();
    expect(validateRecoveryEmail('email-inválido')).toBe('Informe um e-mail válido.');
  });

  it('exige uma nova senha com tamanho mínimo', () => {
    expect(validateNewPassword('curta', 'curta').password).toBe('Use pelo menos 8 caracteres.');
  });

  it('exige confirmação idêntica da nova senha', () => {
    expect(validateNewPassword('senha-segura', 'senha-diferente').passwordConfirmation)
      .toBe('As senhas não coincidem.');
  });
});
