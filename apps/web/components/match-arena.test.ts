import { describe, expect, it } from 'vitest';
import { demoMatch } from '../lib/demo-data';
import { isMatchSnapshot } from './match-arena';

describe('match snapshot validation', () => {
  it('rejects null and incomplete realtime payloads', () => {
    expect(isMatchSnapshot(null)).toBe(false);
    expect(isMatchSnapshot({ version: 1 })).toBe(false);
    expect(isMatchSnapshot({ ...demoMatch, endsAt: null })).toBe(false);
  });

  it('accepts a complete match snapshot', () => {
    expect(isMatchSnapshot(demoMatch)).toBe(true);
  });
});
