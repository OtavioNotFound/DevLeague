import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validatePracticeInput } from './practice.controller.js';

const problemVersionId = '019ff31b-6ec5-72d0-a306-1619d8c33cc7';

describe('practice input', () => {
  it('RF-JUDGE-001 accepts a bounded Run in an enabled language', () => {
    expect(validatePracticeInput('RUN', 'request_12345678', {
      problemVersionId,
      language: 'python',
      source: 'print(input())',
      stdin: 'hello\n'
    })).toMatchObject({ kind: 'RUN', language: 'python', stdin: 'hello\n' });
  });

  it('RN-SUB-002 rejects custom stdin for Submit', () => {
    expect(() => validatePracticeInput('SUBMIT', 'request_12345678', {
      problemVersionId,
      language: 'cpp',
      source: 'int main() {}',
      stdin: 'not allowed'
    })).toThrowError(BadRequestException);
  });

  it('RF-JUDGE-001 rejects oversized source before persistence', () => {
    expect(() => validatePracticeInput('RUN', 'request_12345678', {
      problemVersionId,
      language: 'java',
      source: 'x'.repeat(64 * 1024 + 1)
    })).toThrowError(BadRequestException);
  });
});
