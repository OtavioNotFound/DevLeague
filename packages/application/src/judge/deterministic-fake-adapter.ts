import type {
  CodeExecutionPort,
  ExecutionRequest,
  ExecutionResult
} from './code-execution-port.js';

export class DeterministicFakeCodeExecutionAdapter implements CodeExecutionPort {
  readonly requests: ExecutionRequest[] = [];

  constructor(private readonly results: ReadonlyMap<string, ExecutionResult> = new Map()) {}

  execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.requests.push(request);
    const configured = this.results.get(request.correlationId);
    if (configured) return Promise.resolve(configured);

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
