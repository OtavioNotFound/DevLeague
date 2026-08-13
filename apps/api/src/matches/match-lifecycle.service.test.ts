import { describe, expect, it } from 'vitest';
import { positiveInteger } from './match-lifecycle.service.js';

describe('match lifecycle configuration', () => {
  it('uses bounded positive polling and resolution values', () => {
    expect(positiveInteger('250', 500)).toBe(250);
    expect(positiveInteger('0', 500)).toBe(500);
    expect(positiveInteger('invalid', 60)).toBe(60);
  });
});
