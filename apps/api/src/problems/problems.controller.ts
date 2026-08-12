import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { Difficulty } from '@devleague/persistence';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProblemsService } from './problems.service.js';

interface ProblemListQuery {
  readonly limit?: string;
  readonly cursor?: string;
  readonly difficulty?: string;
}

@Controller('problems')
@UseGuards(JwtAuthGuard)
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: ProblemListQuery
  ) {
    return this.problems.list(principal, parseProblemListQuery(query));
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id') problemId: string
  ) {
    if (!isUuid(problemId)) {
      throw new BadRequestException({ code: 'INVALID_PROBLEM_ID', field: 'id' });
    }
    return this.problems.get(principal, problemId);
  }
}

export function parseProblemListQuery(query: ProblemListQuery): {
  readonly limit: number;
  readonly cursor?: string;
  readonly difficulty?: Difficulty;
} {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException({ code: 'INVALID_PAGINATION', field: 'limit' });
  }
  if (query.cursor !== undefined && !isUuid(query.cursor)) {
    throw new BadRequestException({ code: 'INVALID_PAGINATION', field: 'cursor' });
  }
  if (query.difficulty !== undefined && !isDifficulty(query.difficulty)) {
    throw new BadRequestException({ code: 'INVALID_DIFFICULTY', field: 'difficulty' });
  }

  return {
    limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {})
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'EASY' || value === 'MEDIUM' || value === 'HARD';
}
