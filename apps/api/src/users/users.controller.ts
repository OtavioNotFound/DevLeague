import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards
} from '@nestjs/common';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UsersService, type MeResponse } from './users.service.js';

interface BootstrapBody {
  readonly username?: unknown;
}

interface ConsentBody {
  readonly over18?: unknown;
  readonly termsVersion?: unknown;
  readonly privacyVersion?: unknown;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('users/bootstrap')
  @HttpCode(200)
  bootstrap(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: BootstrapBody
  ): Promise<MeResponse> {
    if (typeof body.username !== 'string' || !/^[A-Za-z0-9_]{3,24}$/.test(body.username)) {
      throw new BadRequestException({
        code: 'INVALID_USERNAME',
        field: 'username',
        message: 'Use de 3 a 24 letras ASCII, números ou underscore.'
      });
    }
    return this.users.bootstrap(principal, body.username);
  }

  @Get('me')
  getMe(@CurrentPrincipal() principal: AuthPrincipal): Promise<MeResponse> {
    return this.users.getMe(principal);
  }

  @Post('me/consents')
  @HttpCode(200)
  recordConsents(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: ConsentBody
  ): Promise<MeResponse> {
    const policy = this.users.policyVersions;
    if (
      body.over18 !== true ||
      body.termsVersion !== policy.termsVersion ||
      body.privacyVersion !== policy.privacyVersion
    ) {
      throw new BadRequestException({
        code: 'CONSENT_VERSION_MISMATCH',
        message: 'É necessário declarar 18+ e aceitar as versões vigentes.'
      });
    }
    return this.users.recordConsents(principal);
  }
}
