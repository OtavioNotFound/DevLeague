import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MatchmakingService } from './matchmaking.service.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Put('entry')
  @HttpCode(202)
  upsert(@CurrentPrincipal() principal: AuthPrincipal, @Body() body: { readonly mode?: unknown }) {
    if (body.mode !== 'RANKED' && body.mode !== 'UNRANKED') {
      throw new BadRequestException({ code: 'INVALID_MATCHMAKING_MODE', field: 'mode' });
    }
    return this.matchmaking.upsert(principal, body.mode);
  }

  @Get('entry')
  get(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.matchmaking.get(principal);
  }

  @Delete('entry')
  @HttpCode(204)
  remove(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.matchmaking.remove(principal);
  }

  @Post('heartbeat')
  heartbeat(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.matchmaking.heartbeat(principal);
  }
}
