import { Injectable } from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload
} from 'jose';
import type { AuthPrincipal } from './auth-principal.js';

interface VerificationConfig {
  readonly issuer: string;
  readonly audience: string;
}

@Injectable()
export class AuthTokenVerifier {
  private readonly verifier: JWTVerifyGetKey | undefined;
  private readonly config: VerificationConfig | undefined;

  constructor() {
    const authBaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const issuer = process.env.SUPABASE_AUTH_ISSUER ??
      (authBaseUrl ? `${authBaseUrl}/auth/v1` : undefined);
    const jwksUrl = process.env.SUPABASE_JWKS_URL ??
      (issuer ? `${issuer}/.well-known/jwks.json` : undefined);

    if (issuer && jwksUrl) {
      this.config = {
        issuer,
        audience: process.env.SUPABASE_AUTH_AUDIENCE ?? 'authenticated'
      };
      this.verifier = createRemoteJWKSet(new URL(jwksUrl));
    }
  }

  get configured(): boolean {
    return Boolean(this.verifier && this.config);
  }

  async verify(token: string): Promise<AuthPrincipal> {
    if (!this.verifier || !this.config) throw new AuthConfigurationError();
    return verifyAccessToken(token, this.verifier, this.config);
  }
}

export class AuthConfigurationError extends Error {
  constructor() {
    super('Supabase JWT verification is not configured.');
    this.name = 'AuthConfigurationError';
  }
}

export async function verifyAccessToken(
  token: string,
  verifier: JWTVerifyGetKey,
  config: VerificationConfig
): Promise<AuthPrincipal> {
  const { payload } = await jwtVerify(token, verifier, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ['ES256', 'RS256']
  });

  const subject = requireSubject(payload);
  return {
    subject,
    emailVerified: readEmailVerified(payload)
  };
}

function requireSubject(payload: JWTPayload): string {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('JWT subject is missing.');
  }
  return payload.sub;
}

function readEmailVerified(payload: JWTPayload): boolean {
  if (payload.email_verified === true) return true;
  const userMetadata = payload.user_metadata;
  return typeof userMetadata === 'object' && userMetadata !== null &&
    'email_verified' in userMetadata && userMetadata.email_verified === true;
}
