import { Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MatchmakingService } from './matchmaking.service.js';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Put('entry')
  @HttpCode(202)
  upsert(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.matchmaking.upsert(principal);
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
