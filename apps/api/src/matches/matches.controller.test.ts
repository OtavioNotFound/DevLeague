import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  validateBrowserMatchSubmissionInput,
  validateMatchSubmissionInput
} from './matches.controller.js';

const matchId = '019ff31b-6ec5-72d0-a306-1619d8c33cc7';

describe('competitive submission input', () => {
  it('RN-SUB-003 requires a valid idempotency key and bounded source', () => {
    expect(validateMatchSubmissionInput(matchId, 'match_request_1', {
      language: 'javascript', source: 'console.log(1)'
    })).toEqual({
      matchId,
      idempotencyKey: 'match_request_1',
      language: 'javascript',
      source: 'console.log(1)'
    });
  });

  it('RF-JUDGE-001 rejects an unsupported language', () => {
    expect(() => validateMatchSubmissionInput(matchId, 'match_request_1', {
      language: 'ruby', source: 'puts 1'
    })).toThrowError(BadRequestException);
  });

  it('RN-MATCH-006 accepts a bounded browser claim covering identified public examples', () => {
    const exampleId = '019ff31b-6ec5-72d0-a306-1619d8c33cc8';
    expect(validateBrowserMatchSubmissionInput(matchId, 'browser_request_1', {
      language: 'python',
      source: 'print(1)',
      publicExampleIds: [exampleId]
    })).toEqual({
      matchId,
      idempotencyKey: 'browser_request_1',
      language: 'python',
      source: 'print(1)',
      publicExampleIds: [exampleId]
    });
  });

  it('RN-MATCH-006 rejects Java and missing public example evidence', () => {
    expect(() => validateBrowserMatchSubmissionInput(matchId, 'browser_request_1', {
      language: 'java', source: 'class Main {}', publicExampleIds: []
    })).toThrowError(BadRequestException);
  });
});
