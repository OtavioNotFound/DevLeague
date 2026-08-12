import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import {
  CompetitiveStore,
  StoreRuleError,
  type PersistedMatchResult,
  type PersistedMatchSnapshot
} from '@devleague/persistence';
import type { AuthPrincipal } from '../auth/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';
import { RuntimePolicyService } from '../practice/runtime-policy.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class MatchesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: UsersService,
    private readonly runtimes: RuntimePolicyService
  ) {}

  async get(principal: AuthPrincipal, matchId: string): Promise<PersistedMatchSnapshot> {
    const me = await this.users.requireEligible(principal);
    const snapshot = await this.store.getSnapshot(matchId, me.id);
    if (!snapshot) throw new NotFoundException({ code: 'MATCH_NOT_FOUND' });
    return snapshot;
  }

  async submit(principal: AuthPrincipal, input: {
    readonly matchId: string;
    readonly language: 'python' | 'java' | 'javascript' | 'cpp';
    readonly source: string;
    readonly idempotencyKey: string;
  }) {
    const me = await this.users.requireEligible(principal);
    const submissionId = randomUUID();
    const requestHash = sha256(JSON.stringify({
      matchId: input.matchId,
      language: input.language,
      source: input.source
    }));
    try {
      return await this.store.admitSubmission({
        id: submissionId,
        matchId: input.matchId,
        userId: me.id,
        languageKey: input.language,
        runtimeVersion: this.runtimes.versions[input.language],
        sourceRef: `db:submission:${submissionId}`,
        source: input.source,
        sourceSha256: sha256(input.source),
        requestHash,
        idempotencyKey: input.idempotencyKey
      });
    } catch (error: unknown) {
      if (error instanceof StoreRuleError && error.code === 'IDEMPOTENCY_KEY_REUSED') {
        throw new ConflictException({ code: error.code });
      }
      if (error instanceof StoreRuleError && (
        error.code === 'MATCH_NOT_ACTIVE' || error.code === 'SUBMISSION_DEADLINE_PASSED'
      )) {
        throw new UnprocessableEntityException({ code: error.code });
      }
      if (error instanceof StoreRuleError && (
        error.code === 'MATCH_NOT_FOUND' || error.code === 'NOT_A_PARTICIPANT'
      )) {
        throw new NotFoundException({ code: 'MATCH_NOT_FOUND' });
      }
      throw error;
    }
  }

  async forfeit(principal: AuthPrincipal, matchId: string): Promise<PersistedMatchResult> {
    const me = await this.users.requireEligible(principal);
    try {
      return await this.store.forfeit(matchId, me.id);
    } catch (error: unknown) {
      if (error instanceof StoreRuleError && (
        error.code === 'MATCH_NOT_FOUND' || error.code === 'NOT_A_PARTICIPANT'
      )) {
        throw new NotFoundException({ code: 'MATCH_NOT_FOUND' });
      }
      throw error;
    }
  }

  private get store(): CompetitiveStore {
    return new CompetitiveStore(this.database.connection);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
