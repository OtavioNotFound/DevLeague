import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MatchesService } from './matches.service.js';

interface MatchSubmissionBody {
  readonly language?: unknown;
  readonly source?: unknown;
}

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get(':id')
  get(@CurrentPrincipal() principal: AuthPrincipal, @Param('id') matchId: string) {
    requireUuid(matchId, 'INVALID_MATCH_ID');
    return this.matches.get(principal, matchId);
  }

  @Get(':id/result')
  async getResult(@CurrentPrincipal() principal: AuthPrincipal, @Param('id') matchId: string) {
    requireUuid(matchId, 'INVALID_MATCH_ID');
    const snapshot = await this.matches.get(principal, matchId);
    return { status: snapshot.status, result: snapshot.result };
  }

  @Post(':id/ready')
  @HttpCode(200)
  ready(@CurrentPrincipal() principal: AuthPrincipal, @Param('id') matchId: string) {
    requireUuid(matchId, 'INVALID_MATCH_ID');
    return this.matches.ready(principal, matchId);
  }

  @Post(':id/submissions')
  @HttpCode(202)
  async submit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id') matchId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: MatchSubmissionBody
  ) {
    const input = validateMatchSubmissionInput(matchId, idempotencyKey, body);
    const submission = await this.matches.submit(principal, input);
    return {
      submissionId: submission.id,
      status: submission.status,
      admissionSeq: submission.admissionSeq,
      pollAfterMs: 500
    };
  }

  @Post(':id/forfeit')
  @HttpCode(200)
  forfeit(@CurrentPrincipal() principal: AuthPrincipal, @Param('id') matchId: string) {
    requireUuid(matchId, 'INVALID_MATCH_ID');
    return this.matches.forfeit(principal, matchId);
  }
}

export function validateMatchSubmissionInput(
  matchId: string,
  idempotencyKey: string | undefined,
  body: MatchSubmissionBody
): {
  readonly matchId: string;
  readonly language: 'python' | 'java' | 'javascript' | 'typescript' | 'lua' | 'cpp';
  readonly source: string;
  readonly idempotencyKey: string;
} {
  requireUuid(matchId, 'INVALID_MATCH_ID');
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY' });
  }
  if (!isLanguage(body.language)) {
    throw new BadRequestException({ code: 'INVALID_LANGUAGE' });
  }
  if (typeof body.source !== 'string' || Buffer.byteLength(body.source, 'utf8') === 0) {
    throw new BadRequestException({ code: 'SOURCE_EMPTY' });
  }
  if (Buffer.byteLength(body.source, 'utf8') > 64 * 1024) {
    throw new BadRequestException({ code: 'SOURCE_TOO_LARGE' });
  }
  return { matchId, language: body.language, source: body.source, idempotencyKey };
}

function requireUuid(value: string, code: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException({ code });
  }
}

function isLanguage(value: unknown): value is 'python' | 'java' | 'javascript' | 'typescript' | 'lua' | 'cpp' {
  return value === 'python' || value === 'java' || value === 'javascript' || value === 'typescript' || value === 'lua' || value === 'cpp';
}
