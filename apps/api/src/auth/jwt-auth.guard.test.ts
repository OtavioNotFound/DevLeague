import { describe, expect, it } from 'vitest';
import { extractBearerToken } from './jwt-auth.guard.js';

describe('extractBearerToken', () => {
  it('accepts exactly one Bearer credential', () => {
    expect(extractBearerToken('Bearer header.payload.signature')).toBe('header.payload.signature');
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer a b', ['Bearer abc']])(
    'rejects malformed authorization value %j',
    (header) => {
      expect(extractBearerToken(header)).toBeNull();
    }
  );
});
