import type {
  ApiErrorEnvelope,
  MatchSnapshot,
  MatchmakingEntry,
  MeResponse,
  PracticeSubmission,
  RecentPracticeSubmission,
  ProblemDetail,
  ProblemSummary,
  SubmissionAcceptedResponse
} from '@devleague/contracts';
import { demoMatch, demoMe, demoProblem, demoProblems } from './demo-data';
import { publicConfig } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export class DevLeagueApi {
  constructor(private readonly getToken: () => Promise<string | null>) {}

  async me(): Promise<MeResponse> {
    if (publicConfig.demoMode) return demoMe;
    return this.request('/me');
  }

  async bootstrapUser(username: string): Promise<MeResponse> {
    if (publicConfig.demoMode) return { ...demoMe, username };
    return this.request('/users/bootstrap', { method: 'POST', body: { username } });
  }

  async recordConsents(): Promise<MeResponse> {
    if (publicConfig.demoMode) return demoMe;
    return this.request('/me/consents', {
      method: 'POST',
      body: {
        over18: true,
        termsVersion: publicConfig.termsVersion,
        privacyVersion: publicConfig.privacyVersion
      }
    });
  }

  async problems(): Promise<{ items: readonly ProblemSummary[]; nextCursor: string | null }> {
    if (publicConfig.demoMode) return { items: demoProblems, nextCursor: null };
    return this.request('/problems');
  }

  async problem(id: string): Promise<ProblemDetail> {
    if (publicConfig.demoMode) return { ...demoProblem, id };
    return this.request(`/problems/${id}`);
  }

  async match(id: string): Promise<MatchSnapshot> {
    if (publicConfig.demoMode) return { ...demoMatch, id };
    return this.request(`/matches/${id}`);
  }

  async submitPractice(input: {
    problemVersionId: string;
    language: string;
    source: string;
    kind: 'runs' | 'submissions';
    stdin?: string;
  }): Promise<SubmissionAcceptedResponse> {
    if (publicConfig.demoMode) {
      return { submissionId: crypto.randomUUID(), status: 'QUEUED', pollAfterMs: 500 };
    }
    const { kind, ...body } = input;
    return this.request(`/practice/${kind}`, {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
      body
    });
  }

  async submission(id: string): Promise<PracticeSubmission> {
    if (publicConfig.demoMode) {
      return {
        id, userId: demoMe.id, problemVersionId: demoProblem.versionId,
        kind: 'RUN', language: 'python', runtimeVersion: '3.13', status: 'FINISHED',
        verdict: 'ACCEPTED', stdout: '5 4 3 2 1\n', stderr: null, compileOutput: null,
        createdAt: new Date().toISOString(), finishedAt: new Date().toISOString()
      };
    }
    return this.request(`/submissions/${id}`);
  }

  async recentPractice(): Promise<readonly RecentPracticeSubmission[]> {
    if (publicConfig.demoMode) return [];
    return this.request('/practice/recent');
  }

  async joinQueue(mode: 'RANKED' | 'UNRANKED'): Promise<MatchmakingEntry> {
    if (publicConfig.demoMode) return { id: crypto.randomUUID(), userId: demoMe.id, rating: demoMe.rating, region: 'br-sa-east', mode, enteredAt: Date.now(), expiresAt: Date.now() + 30_000 };
    return this.request('/matchmaking/entry', { method: 'PUT', body: { mode } });
  }

  async leaveQueue(): Promise<void> {
    if (publicConfig.demoMode) return;
    await this.request('/matchmaking/entry', { method: 'DELETE' });
  }

  async heartbeatQueue(): Promise<MatchmakingEntry | null> {
    if (publicConfig.demoMode) return { id: crypto.randomUUID(), userId: demoMe.id, rating: demoMe.rating, region: 'br-sa-east', mode: 'RANKED', enteredAt: Date.now() - 5_000, expiresAt: Date.now() + 30_000 };
    const entry = await this.request<MatchmakingEntry | undefined>('/matchmaking/heartbeat', {
      method: 'POST',
      allowEmpty: true
    });
    return entry ?? null;
  }

  async submitMatch(input: { matchId: string; language: string; source: string }): Promise<SubmissionAcceptedResponse> {
    if (publicConfig.demoMode) return { submissionId: crypto.randomUUID(), status: 'QUEUED', admissionSeq: 4, pollAfterMs: 500 };
    const idempotencyKey = await submissionIdempotencyKey(input);
    return this.request(`/matches/${input.matchId}/submissions`, {
      method: 'POST', idempotencyKey, body: { language: input.language, source: input.source }
    });
  }

  async readyMatch(matchId: string): Promise<MatchSnapshot> {
    if (publicConfig.demoMode) {
      return {
        ...demoMatch,
        id: matchId,
        participants: demoMatch.participants.map((participant) => ({ ...participant, ready: true }))
      };
    }
    return this.request(`/matches/${matchId}/ready`, { method: 'POST' });
  }

  async forfeitMatch(matchId: string): Promise<unknown> {
    if (publicConfig.demoMode) return { matchId, reason: 'FORFEIT' };
    return this.request(`/matches/${matchId}/forfeit`, { method: 'POST' });
  }

  private async request<T>(path: string, options: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
    allowEmpty?: boolean;
  } = {}): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${publicConfig.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const rawBody = response.status === 204 ? '' : await response.text();
    const payload = parseJson(rawBody);
    if (!response.ok) {
      const error = payload as ApiErrorEnvelope | null;
      throw new ApiError(
        response.status,
        error?.error.code ?? 'HTTP_ERROR',
        error?.error.requestId,
        error?.error.retryable ?? false,
        error?.error.details
      );
    }
    if (rawBody.length === 0) {
      if (response.status === 204 || options.allowEmpty) return undefined as T;
      throw new ApiError(response.status, 'EMPTY_API_RESPONSE');
    }
    if (payload === null) throw new ApiError(response.status, 'INVALID_API_RESPONSE');
    return payload as T;
  }
}

function parseJson(value: string): unknown {
  if (value.length === 0) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function submissionIdempotencyKey(input: { matchId: string; language: string; source: string }): Promise<string> {
  const payload = new TextEncoder().encode(`${input.matchId}\0${input.language}\0${input.source}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return `match_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
