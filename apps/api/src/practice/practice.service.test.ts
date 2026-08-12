import { describe, expect, it } from 'vitest';
import type { PracticeSubmissionRecord } from '@devleague/persistence';
import { toPublicSubmission } from './practice.service.js';

const submission: PracticeSubmissionRecord = {
  id: 'submission-1',
  userId: 'user-1',
  problemVersionId: 'problem-1',
  kind: 'SUBMIT',
  language: 'python',
  runtimeVersion: '3.13',
  status: 'FINISHED',
  verdict: 'WRONG_ANSWER',
  stdout: 'private-case-output',
  stderr: 'private-case-input',
  compileOutput: null,
  createdAt: new Date('2026-08-11T00:00:00Z'),
  finishedAt: new Date('2026-08-11T00:00:01Z')
};

describe('public practice submission representation', () => {
  it('RN-PROB-007 hides private-case stdout and stderr for Submit', () => {
    expect(toPublicSubmission(submission)).toMatchObject({
      verdict: 'WRONG_ANSWER',
      stdout: null,
      stderr: null
    });
  });

  it('RF-PRACTICE-001 preserves console output for Run', () => {
    expect(toPublicSubmission({ ...submission, kind: 'RUN' })).toMatchObject({
      stdout: 'private-case-output',
      stderr: 'private-case-input'
    });
  });
});
