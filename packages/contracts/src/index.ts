export type LanguageKey = 'python' | 'java' | 'javascript' | 'typescript' | 'lua' | 'cpp';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type SubmissionStatus = 'QUEUED' | 'RUNNING' | 'FINISHED';
export type SubmissionVerdict =
  | 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILE_ERROR' | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED' | 'SYSTEM_ERROR' | 'CANCELLED';

export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
  };
}

export interface MeResponse {
  readonly id: string;
  readonly username: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  readonly rating: number;
  readonly stats: {
    readonly peakRating: number;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
  };
  readonly activeMatchId: string | null;
  readonly consents: {
    readonly termsVersion: string | null;
    readonly privacyVersion: string | null;
    readonly over18: boolean;
  };
  readonly eligibility: {
    readonly eligible: boolean;
    readonly reasons: readonly string[];
  };
}

export interface ProblemSummary {
  readonly id: string;
  readonly versionId: string;
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly categories: readonly string[];
  readonly languages: readonly LanguageKey[];
}

export interface ProblemDetail extends ProblemSummary {
  readonly statementMarkdown: string;
  readonly constraintsMarkdown: string;
  readonly starterCode: Readonly<Partial<Record<LanguageKey, string>>>;
  readonly examples: readonly {
    readonly id: string;
    readonly stdin: string;
    readonly expectedOutput: string;
  }[];
}

export interface SubmissionAcceptedResponse {
  readonly submissionId: string;
  readonly status: SubmissionStatus;
  readonly admissionSeq?: number;
  readonly pollAfterMs: number;
}

export interface PracticeSubmission {
  readonly id: string;
  readonly userId: string;
  readonly problemVersionId: string;
  readonly kind: 'RUN' | 'SUBMIT';
  readonly language: LanguageKey;
  readonly runtimeVersion: string;
  readonly status: SubmissionStatus;
  readonly verdict: SubmissionVerdict | null;
  readonly stdout: string | null;
  readonly stderr: string | null;
  readonly compileOutput: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

export interface RecentPracticeSubmission extends PracticeSubmission {
  readonly problemTitle: string;
}

export interface MatchmakingEntry {
  readonly id: string;
  readonly userId: string;
  readonly rating: number;
  readonly region: string;
  readonly mode: 'RANKED' | 'UNRANKED';
  readonly enteredAt: number;
  readonly expiresAt: number;
}

export interface MatchSnapshot {
  readonly id: string;
  readonly currentUserId: string;
  readonly type: 'RANKED_PUBLIC' | 'UNRANKED_PUBLIC' | 'PRIVATE_UNRANKED';
  readonly status: 'COUNTDOWN' | 'ACTIVE' | 'RESOLVING' | 'FINISHED' | 'CANCELLED';
  readonly serverNow: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly lobbyExpiresAt: string | null;
  readonly version: number;
  readonly problem: ProblemDetail | null;
  readonly participants: readonly {
    readonly userId: string;
    readonly username: string;
    readonly submissions: number;
    readonly ready: boolean;
  }[];
  readonly mySubmissions: readonly {
    readonly id: string;
    readonly admissionSeq: number;
    readonly status: SubmissionStatus;
    readonly verdict: SubmissionVerdict | null;
  }[];
  readonly result: MatchResult | null;
}

export interface MatchResult {
  readonly matchId: string;
  readonly reason: 'ACCEPTED' | 'FORFEIT' | 'DRAW_TIMEOUT' | 'VOID_SYSTEM';
  readonly winnerUserId: string | null;
  readonly winningSubmissionId: string | null;
  readonly finishedAt: string;
  readonly ratingChanges: readonly {
    readonly userId: string;
    readonly before: number;
    readonly delta: number;
    readonly after: number;
  }[];
}

export interface MatchRealtimeClientEvents {
  readonly 'match.join': {
    readonly matchId: string;
    readonly lastEventSeq?: number;
  };
  readonly 'match.resync': {
    readonly matchId: string;
    readonly lastEventSeq?: number;
  };
}

export interface MatchRealtimeServerEvents {
  readonly 'match.snapshot': MatchSnapshot;
  readonly 'participant.presence': {
    readonly eventSeq?: number;
    readonly userId: string;
    readonly connected: boolean;
  };
}
