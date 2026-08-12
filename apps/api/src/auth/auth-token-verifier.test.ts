import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { describe, expect, it } from 'vitest';
import { verifyAccessToken } from './auth-token-verifier.js';

describe('verifyAccessToken', () => {
  it('RF-AUTH-002 verifies signature, issuer, audience and subject', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'ES256';
    const verifier = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({ email_verified: true })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer('https://project.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setSubject('auth-user-123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifyAccessToken(token, verifier, {
      issuer: 'https://project.supabase.co/auth/v1',
      audience: 'authenticated'
    })).resolves.toEqual({ subject: 'auth-user-123', emailVerified: true });
  });

  it('RNF-SEC-004 rejects a token from a different issuer', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);
    const verifier = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer('https://attacker.invalid/auth/v1')
      .setAudience('authenticated')
      .setSubject('auth-user-123')
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifyAccessToken(token, verifier, {
      issuer: 'https://project.supabase.co/auth/v1',
      audience: 'authenticated'
    })).rejects.toThrow();
  });
});
