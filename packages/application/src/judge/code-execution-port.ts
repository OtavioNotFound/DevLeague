export type ExecutionLanguage = 'python' | 'java' | 'javascript' | 'cpp';

export type ExecutionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED'
  | 'SYSTEM_ERROR'
  | 'CANCELLED';

export interface ExecutionRequest {
  readonly correlationId: string;
  readonly runtime: {
    readonly language: ExecutionLanguage;
    readonly version: string;
  };
  readonly source: string;
  readonly cases: readonly {
    readonly caseId: string;
    readonly stdin: string;
    readonly expectedOutput?: string;
  }[];
  readonly limits: {
    readonly cpuMs: number;
    readonly wallMs: number;
    readonly memoryKb: number;
    readonly processes: number;
    readonly outputBytes: number;
    readonly fileBytes: number;
  };
  readonly network: 'DENY';
}

export interface ExecutionResult {
  readonly verdict: ExecutionVerdict;
  readonly caseResults?: readonly {
    readonly caseId: string;
    readonly verdict: ExecutionVerdict;
    readonly cpuMs?: number;
    readonly memoryKb?: number;
  }[];
  readonly stdout?: string;
  readonly stderr?: string;
  readonly compileOutput?: string;
  readonly usage: {
    readonly cpuMs?: number;
    readonly wallMs?: number;
    readonly peakMemoryKb?: number;
  };
  readonly providerFailure?: {
    readonly retryable: boolean;
    readonly category: string;
  };
}

export interface CodeExecutionPort {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
