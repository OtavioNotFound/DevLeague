import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthPrincipal {
  readonly subject: string;
  readonly emailVerified: boolean;
}

export interface AuthenticatedRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  authPrincipal?: AuthPrincipal;
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authPrincipal) throw new Error('Authentication guard did not set a principal.');
    return request.authPrincipal;
  }
);
