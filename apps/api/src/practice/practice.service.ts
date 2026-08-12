import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import {
  PracticeStore,
  StoreRuleError,
  type LanguageKey,
  type PracticeKind,
  type PracticeSubmissionRecord,
  type RecentPracticeSubmissionRecord
} from '@devleague/persistence';
import type { AuthPrincipal } from '../auth/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from '../users/users.service.js';
import { RuntimePolicyService } from './runtime-policy.service.js';

@Injectable()
export class PracticeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: UsersService,
    private readonly runtimes: RuntimePolicyService
  ) {}

  async admit(principal: AuthPrincipal, input: {
    readonly kind: PracticeKind;
    readonly problemVersionId: string;
    readonly language: LanguageKey;
    readonly source: string;
    readonly stdin?: string;
    readonly idempotencyKey: string;
  }): Promise<PracticeSubmissionRecord> {
    const me = await this.users.requireEligible(principal);
    const requestHash = sha256(JSON.stringify({
      kind: input.kind,
      problemVersionId: input.problemVersionId,
      language: input.language,
      source: input.source,
      stdin: input.stdin ?? null
    }));

    try {
      const submission = await this.store.admit({
        id: randomUUID(),
        userId: me.id,
        problemVersionId: input.problemVersionId,
        kind: input.kind,
        language: input.language,
        runtimeVersion: this.runtimes.versions[input.language],
        source: input.source,
        sourceSha256: sha256(input.source),
        ...(input.stdin !== undefined ? { customStdin: input.stdin } : {}),
        requestHash,
        idempotencyKey: input.idempotencyKey
      });
      return toPublicSubmission(submission);
    } catch (error: unknown) {
      if (error instanceof StoreRuleError && error.code === 'IDEMPOTENCY_KEY_REUSED') {
        throw new ConflictException({ code: error.code });
      }
      if (error instanceof StoreRuleError && error.code === 'PROBLEM_NOT_AVAILABLE') {
        throw new UnprocessableEntityException({ code: error.code });
      }
      throw error;
    }
  }

  async get(principal: AuthPrincipal, submissionId: string): Promise<PracticeSubmissionRecord> {
    const me = await this.users.requireEligible(principal);
    const submission = await this.store.findOwned(submissionId, me.id);
    if (!submission) throw new NotFoundException({ code: 'SUBMISSION_NOT_FOUND' });
    return toPublicSubmission(submission);
  }

  async recent(principal: AuthPrincipal): Promise<readonly RecentPracticeSubmissionRecord[]> {
    const me = await this.users.requireEligible(principal);
    return this.store.listRecent(me.id, 10);
  }

  private get store(): PracticeStore {
    return new PracticeStore(this.database.connection);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function toPublicSubmission(
  submission: PracticeSubmissionRecord
): PracticeSubmissionRecord {
  if (submission.kind === 'RUN') return submission;
  return { ...submission, stdout: null, stderr: null };
}
