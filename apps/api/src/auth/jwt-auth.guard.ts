import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { AuthConfigurationError, AuthTokenVerifier } from './auth-token-verifier.js';
import type { AuthenticatedRequest } from './auth-principal.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: AuthTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Bearer token ausente ou inválido.');

    try {
      request.authPrincipal = await this.verifier.verify(token);
      return true;
    } catch (error: unknown) {
      if (error instanceof AuthConfigurationError) {
        throw new ServiceUnavailableException('Autenticação não configurada.');
      }
      throw new UnauthorizedException('Token ausente, inválido ou expirado.');
    }
  }
}

export function extractBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}
