import { randomUUID } from 'node:crypto';
import type { MatchCreationPort, MatchmakingPair } from '@devleague/application';
import { CompetitiveStore } from '../postgres/competitive-store.js';
import type { Database } from '../postgres/database.js';
import { StoreRuleError } from '../postgres/store-errors.js';

export class RankedMatchFactory implements MatchCreationPort {
  private readonly matches: CompetitiveStore;

  constructor(private readonly database: Database) {
    this.matches = new CompetitiveStore(database);
  }

  async createMatch(pair: MatchmakingPair): Promise<string> {
    const [problem] = await this.database<{ versionId: string }[]>`
      select pv.id as version_id
      from devleague.problem p
      join lateral (
        select selected.* from devleague.problem_version selected
        where selected.problem_id = p.id and selected.competitive_eligible = true
        order by selected.version_number desc limit 1
      ) pv on true
      where p.status = 'PUBLISHED'
      order by (
        select count(*) from devleague.problem_exposure pe
        where pe.problem_version_id = pv.id
          and pe.user_id in (${pair.first.userId}, ${pair.second.userId})
      ), pv.id
      limit 1
    `;
    if (!problem) {
      throw new StoreRuleError('COMPETITIVE_PROBLEM_UNAVAILABLE', 'No competitive problem available.');
    }

    return this.matches.createMatch({
      id: randomUUID(),
      originKey: `matchmaking:${pair.id}`,
      type: pair.mode === 'RANKED' ? 'RANKED_PUBLIC' : 'UNRANKED_PUBLIC',
      problemVersionId: problem.versionId,
      participantUserIds: [pair.first.userId, pair.second.userId],
      startsAt: new Date(Date.now() + 3_000)
    });
  }
}
