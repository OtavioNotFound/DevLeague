import { Module } from '@nestjs/common';
import { AuthTokenVerifier } from './auth/auth-token-verifier.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { DatabaseService } from './database/database.service.js';
import { HealthController } from './health/health.controller.js';
import { MatchesController } from './matches/matches.controller.js';
import { MatchesService } from './matches/matches.service.js';
import { MatchmakingController } from './matchmaking/matchmaking.controller.js';
import { MatchmakingService } from './matchmaking/matchmaking.service.js';
import { MatchmakingLoopService } from './matchmaking/matchmaking-loop.service.js';
import { ProblemsController } from './problems/problems.controller.js';
import { ProblemsService } from './problems/problems.service.js';
import { PracticeController } from './practice/practice.controller.js';
import { PracticeService } from './practice/practice.service.js';
import { RuntimePolicyService } from './practice/runtime-policy.service.js';
import { RedisService } from './redis/redis.service.js';
import { MatchGateway } from './realtime/match.gateway.js';
import { AlphaPolicyService } from './users/alpha-policy.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [
    HealthController,
    UsersController,
    ProblemsController,
    PracticeController,
    MatchesController,
    MatchmakingController
  ],
  providers: [
    DatabaseService,
    AuthTokenVerifier,
    JwtAuthGuard,
    AlphaPolicyService,
    UsersService,
    ProblemsService,
    PracticeService,
    RuntimePolicyService,
    MatchesService,
    RedisService,
    MatchmakingService,
    MatchmakingLoopService,
    MatchGateway
  ]
})
export class AppModule {}
