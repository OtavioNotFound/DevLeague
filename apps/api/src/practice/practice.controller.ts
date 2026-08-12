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
import type { LanguageKey, PracticeKind } from '@devleague/persistence';
import { CurrentPrincipal, type AuthPrincipal } from '../auth/auth-principal.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PracticeService } from './practice.service.js';

interface PracticeBody {
  readonly problemVersionId?: unknown;
  readonly language?: unknown;
  readonly source?: unknown;
  readonly stdin?: unknown;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Post('practice/runs')
  @HttpCode(202)
  run(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PracticeBody
  ) {
    return this.admit(principal, 'RUN', idempotencyKey, body);
  }

  @Post('practice/submissions')
  @HttpCode(202)
  submit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PracticeBody
  ) {
    return this.admit(principal, 'SUBMIT', idempotencyKey, body);
  }

  @Get('submissions/:id')
  get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id') submissionId: string
  ) {
    if (!isUuid(submissionId)) {
      throw new BadRequestException({ code: 'INVALID_SUBMISSION_ID', field: 'id' });
    }
    return this.practice.get(principal, submissionId);
  }

  private admit(
    principal: AuthPrincipal,
    kind: PracticeKind,
    idempotencyKey: string | undefined,
    body: PracticeBody
  ) {
    const input = validatePracticeInput(kind, idempotencyKey, body);
    return this.practice.admit(principal, input).then((submission) => ({
      submissionId: submission.id,
      status: submission.status,
      pollAfterMs: 500
    }));
  }
}

export function validatePracticeInput(
  kind: PracticeKind,
  idempotencyKey: string | undefined,
  body: PracticeBody
): {
  readonly kind: PracticeKind;
  readonly problemVersionId: string;
  readonly language: LanguageKey;
  readonly source: string;
  readonly stdin?: string;
  readonly idempotencyKey: string;
} {
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY' });
  }
  if (typeof body.problemVersionId !== 'string' || !isUuid(body.problemVersionId)) {
    throw new BadRequestException({ code: 'INVALID_PROBLEM_VERSION_ID' });
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
  if (body.stdin !== undefined && typeof body.stdin !== 'string') {
    throw new BadRequestException({ code: 'INVALID_STDIN' });
  }
  if (typeof body.stdin === 'string' && Buffer.byteLength(body.stdin, 'utf8') > 16 * 1024) {
    throw new BadRequestException({ code: 'STDIN_TOO_LARGE' });
  }
  if (kind === 'SUBMIT' && body.stdin !== undefined) {
    throw new BadRequestException({ code: 'STDIN_NOT_ALLOWED_FOR_SUBMIT' });
  }

  return {
    kind,
    problemVersionId: body.problemVersionId,
    language: body.language,
    source: body.source,
    ...(typeof body.stdin === 'string' ? { stdin: body.stdin } : {}),
    idempotencyKey
  };
}

function isLanguage(value: unknown): value is LanguageKey {
  return value === 'python' || value === 'java' || value === 'javascript' || value === 'cpp';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
