export class MatchRuleError extends Error {
  constructor(
    public readonly code: MatchRuleErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'MatchRuleError';
  }
}

export type MatchRuleErrorCode =
  | 'INVALID_PARTICIPANTS'
  | 'INVALID_DURATION'
  | 'INVALID_TRANSITION'
  | 'NOT_A_PARTICIPANT'
  | 'SUBMISSION_ID_REUSED'
  | 'SUBMISSION_DEADLINE_PASSED'
  | 'SUBMISSION_NOT_FOUND'
  | 'SUBMISSION_ALREADY_TERMINAL'
  | 'MATCH_ALREADY_TERMINAL';
