import type {
  CodeExecutionPort,
  ExecutionLanguage,
  ExecutionRequest,
  ExecutionResult
} from './code-execution-port.js';

const MAX_SOURCE_BYTES = 64 * 1024;

export interface ExecutionProblemSpec {
  readonly cases: readonly {
    readonly id: string;
    readonly stdin: string;
    readonly expectedOutput: string;
  }[];
  readonly limits: ExecutionRequest['limits'];
}

export class CodeExecutionService {
  constructor(
    private readonly port: CodeExecutionPort,
    private readonly runtimeVersions: Readonly<Record<ExecutionLanguage, string>>
  ) {}

  execute(input: {
    readonly correlationId: string;
    readonly language: ExecutionLanguage;
    readonly source: string;
    readonly problem: ExecutionProblemSpec;
  }): Promise<ExecutionResult> {
    if (Buffer.byteLength(input.source, 'utf8') === 0) {
      throw new ExecutionValidationError('SOURCE_EMPTY');
    }
    if (Buffer.byteLength(input.source, 'utf8') > MAX_SOURCE_BYTES) {
      throw new ExecutionValidationError('SOURCE_TOO_LARGE');
    }
    if (input.problem.cases.length === 0) {
      throw new ExecutionValidationError('TEST_CASES_MISSING');
    }

    return this.port.execute({
      correlationId: input.correlationId,
      runtime: {
        language: input.language,
        version: this.runtimeVersions[input.language]
      },
      source: input.source,
      cases: input.problem.cases.map((testCase) => ({
        caseId: testCase.id,
        stdin: testCase.stdin,
        expectedOutput: testCase.expectedOutput
      })),
      limits: input.problem.limits,
      network: 'DENY'
    });
  }
}

export type ExecutionValidationErrorCode =
  | 'SOURCE_EMPTY'
  | 'SOURCE_TOO_LARGE'
  | 'TEST_CASES_MISSING';

export class ExecutionValidationError extends Error {
  constructor(readonly code: ExecutionValidationErrorCode) {
    super(code);
    this.name = 'ExecutionValidationError';
  }
}
