import { describe, expect, it } from 'vitest';
import { CodeExecutionService, ExecutionValidationError } from './code-execution-service.js';
import { DeterministicFakeCodeExecutionAdapter } from './deterministic-fake-adapter.js';
import type { ExecutionResult } from './code-execution-port.js';

const accepted: ExecutionResult = {
  verdict: 'ACCEPTED',
  usage: { cpuMs: 12, wallMs: 20, peakMemoryKb: 1024 }
};

const problem = {
  cases: [{ id: 'case-1', stdin: '1\n', expectedOutput: '2\n' }],
  limits: {
    cpuMs: 1000,
    wallMs: 3000,
    memoryKb: 262144,
    processes: 8,
    outputBytes: 65536,
    fileBytes: 1048576
  }
};

describe('CodeExecutionService', () => {
  it('RF-JUDGE-002 sends only the provider-neutral contract with network denied', async () => {
    const adapter = new DeterministicFakeCodeExecutionAdapter(new Map([['execution-1', accepted]]));
    const service = new CodeExecutionService(adapter, {
      python: '3.13', java: '21', javascript: '24', cpp: '23'
    });

    await expect(service.execute({
      correlationId: 'execution-1',
      language: 'python',
      source: 'print(2)',
      problem
    })).resolves.toEqual(accepted);
    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]).toMatchObject({
      network: 'DENY',
      runtime: { language: 'python', version: '3.13' },
      cases: [{ caseId: 'case-1', stdin: '1\n', expectedOutput: '2\n' }]
    });
  });

  it('RF-JUDGE-001 rejects source larger than 64 KiB before calling a provider', () => {
    const service = new CodeExecutionService(new DeterministicFakeCodeExecutionAdapter(), {
      python: '3.13', java: '21', javascript: '24', cpp: '23'
    });

    expect(() => service.execute({
      correlationId: 'execution-2',
      language: 'cpp',
      source: 'x'.repeat(64 * 1024 + 1),
      problem
    })).toThrowError(ExecutionValidationError);
  });

  it('RF-JUDGE-007 never turns an unconfigured fake result into Wrong Answer', async () => {
    const service = new CodeExecutionService(new DeterministicFakeCodeExecutionAdapter(), {
      python: '3.13', java: '21', javascript: '24', cpp: '23'
    });

    await expect(service.execute({
      correlationId: 'missing-fixture',
      language: 'java',
      source: 'class Main {}',
      problem
    })).resolves.toMatchObject({
      verdict: 'SYSTEM_ERROR',
      providerFailure: { category: 'FAKE_RESULT_NOT_CONFIGURED' }
    });
  });
});
