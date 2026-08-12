import type {
  CodeExecutionPort,
  ExecutionRequest,
  ExecutionResult
} from './code-execution-port.js';

export class DeterministicFakeCodeExecutionAdapter implements CodeExecutionPort {
  readonly requests: ExecutionRequest[] = [];

  constructor(
    private readonly results: ReadonlyMap<string, ExecutionResult> = new Map(),
    private readonly fallback: 'SYSTEM_ERROR' | 'ACCEPTED' = 'SYSTEM_ERROR'
  ) {}

  execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.requests.push(request);
    const configured = this.results.get(request.correlationId);
    if (configured) return Promise.resolve(configured);

    if (this.fallback === 'ACCEPTED') {
      return Promise.resolve({
        verdict: 'ACCEPTED',
        caseResults: request.cases.map((testCase) => ({
          caseId: testCase.caseId,
          verdict: 'ACCEPTED',
          cpuMs: 1,
          memoryKb: 1024
        })),
        stdout: request.cases[0]?.expectedOutput ?? '',
        usage: { cpuMs: 1, wallMs: 1, peakMemoryKb: 1024 }
      });
    }

    return Promise.resolve({
      verdict: 'SYSTEM_ERROR',
      usage: {},
      providerFailure: {
        retryable: false,
        category: 'FAKE_RESULT_NOT_CONFIGURED'
      }
    });
  }
}
