import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogStore,
  type CatalogProblemDetail,
  type CatalogProblemSummary,
  type Difficulty
} from '@devleague/persistence';
import type { AuthPrincipal } from '../auth/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class ProblemsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: UsersService
  ) {}

  async list(
    principal: AuthPrincipal,
    input: { readonly limit: number; readonly cursor?: string; readonly difficulty?: Difficulty }
  ): Promise<{
    readonly items: readonly CatalogProblemSummary[];
    readonly nextCursor: string | null;
  }> {
    await this.users.requireEligible(principal);
    return this.store.listPublished(input);
  }

  async get(principal: AuthPrincipal, problemId: string): Promise<CatalogProblemDetail> {
    const me = await this.users.requireEligible(principal);
    const problem = await this.store.getPublishedForPractice({ problemId, userId: me.id });
    if (!problem) throw new NotFoundException({ code: 'PROBLEM_NOT_FOUND' });
    return problem;
  }

  private get store(): CatalogStore {
    return new CatalogStore(this.database.connection);
  }
}
