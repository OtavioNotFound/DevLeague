import type {
  ApiErrorEnvelope,
  MatchSnapshot,
  MatchmakingEntry,
  MeResponse,
  PracticeSubmission,
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
    readonly retryable = false
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

  async joinQueue(): Promise<MatchmakingEntry> {
    if (publicConfig.demoMode) return { id: crypto.randomUUID(), userId: demoMe.id, rating: demoMe.rating, region: 'br-sa-east', enteredAt: Date.now(), expiresAt: Date.now() + 30_000 };
    return this.request('/matchmaking/entry', { method: 'PUT' });
  }

  async leaveQueue(): Promise<void> {
    if (publicConfig.demoMode) return;
    await this.request('/matchmaking/entry', { method: 'DELETE' });
  }

  async heartbeatQueue(): Promise<MatchmakingEntry | null> {
    if (publicConfig.demoMode) return { id: crypto.randomUUID(), userId: demoMe.id, rating: demoMe.rating, region: 'br-sa-east', enteredAt: Date.now() - 5_000, expiresAt: Date.now() + 30_000 };
    return this.request('/matchmaking/heartbeat', { method: 'POST' });
  }

  async submitMatch(input: { matchId: string; language: string; source: string }): Promise<SubmissionAcceptedResponse> {
    if (publicConfig.demoMode) return { submissionId: crypto.randomUUID(), status: 'QUEUED', admissionSeq: 4, pollAfterMs: 500 };
    return this.request(`/matches/${input.matchId}/submissions`, {
      method: 'POST', idempotencyKey: crypto.randomUUID(), body: { language: input.language, source: input.source }
    });
  }

  async forfeitMatch(matchId: string): Promise<unknown> {
    if (publicConfig.demoMode) return { matchId, reason: 'FORFEIT' };
    return this.request(`/matches/${matchId}/forfeit`, { method: 'POST' });
  }

  private async request<T>(path: string, options: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
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
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as ApiErrorEnvelope | null;
      throw new ApiError(response.status, payload?.error.code ?? 'HTTP_ERROR', payload?.error.requestId, payload?.error.retryable ?? false);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
