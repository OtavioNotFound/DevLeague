import { describe, expect, it } from 'vitest';
import {
  isCasualBrowserExecutionEnabled,
  isCompetitiveExecutionEnabled,
  isMatchmakingExecutionEnabled,
  isMatchmakingModeEnabled
} from './matchmaking.service.js';

describe('matchmaking safety gate', () => {
  it('RN-MATCH-001 keeps ranked disabled until the production judge is explicitly ready', () => {
    expect(isMatchmakingModeEnabled('RANKED', {})).toBe(false);
    expect(isMatchmakingModeEnabled('RANKED', { RANKED_MATCHMAKING_ENABLED: 'false' })).toBe(false);
    expect(isMatchmakingModeEnabled('RANKED', { RANKED_MATCHMAKING_ENABLED: 'true' })).toBe(true);
  });

  it('keeps public unranked available independently from the ranked gate', () => {
    expect(isMatchmakingModeEnabled('UNRANKED', {})).toBe(true);
  });

  it('requires an explicit gate before any competitive execution is accepted', () => {
    expect(isCompetitiveExecutionEnabled({})).toBe(false);
    expect(isCompetitiveExecutionEnabled({ COMPETITIVE_EXECUTION_ENABLED: 'true' })).toBe(true);
  });

  it('RN-MATCH-006 enables only unranked through the browser execution gate', () => {
    const environment = { ALPHA_BROWSER_MATCHES_UNRANKED: 'true' };
    expect(isCasualBrowserExecutionEnabled(environment)).toBe(true);
    expect(isMatchmakingExecutionEnabled('UNRANKED', environment)).toBe(true);
    expect(isMatchmakingExecutionEnabled('RANKED', environment)).toBe(false);
  });
});
