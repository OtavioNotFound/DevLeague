export type StoreRuleErrorCode =
  | 'MATCH_NOT_FOUND'
  | 'MATCH_NOT_ACTIVE'
  | 'MATCH_ALREADY_TERMINAL'
  | 'LOBBY_EXPIRED'
  | 'NOT_A_PARTICIPANT'
  | 'SUBMISSION_NOT_FOUND'
  | 'SUBMISSION_DEADLINE_PASSED'
  | 'SUBMISSION_RATE_LIMITED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'SUBMISSION_ALREADY_TERMINAL'
  | 'RATING_ACCOUNT_MISSING'
  | 'USERNAME_TAKEN'
  | 'USER_NOT_BOOTSTRAPPED'
  | 'USER_NOT_ELIGIBLE'
  | 'PROBLEM_NOT_AVAILABLE'
  | 'EXECUTION_JOB_NOT_FOUND'
  | 'EXECUTION_JOB_NOT_RUNNING'
  | 'TEST_CASES_MISSING'
  | 'COMPETITIVE_PROBLEM_UNAVAILABLE';

export class StoreRuleError extends Error {
  constructor(
    public readonly code: StoreRuleErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'StoreRuleError';
  }
}
