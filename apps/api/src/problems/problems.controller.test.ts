import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseProblemListQuery } from './problems.controller.js';

describe('problem catalog query', () => {
  it('RF-PROBLEM-001 applies bounded pagination and difficulty filter', () => {
    expect(parseProblemListQuery({ limit: '50', difficulty: 'MEDIUM' })).toEqual({
      limit: 50,
      difficulty: 'MEDIUM'
    });
  });

  it.each([{ limit: '0' }, { limit: '101' }, { limit: 'NaN' }, { difficulty: 'IMPOSSIBLE' }])(
    'rejects invalid query %j',
    (query) => {
      expect(() => parseProblemListQuery(query)).toThrowError(BadRequestException);
    }
  );
});
