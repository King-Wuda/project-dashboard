import { describe, expect, it } from 'vitest';
import { handoverKey } from './Resources';

describe('handoverKey', () => {
  it('orders quarters, months and unknowns', () => {
    const labels = ["Q2 '27", 'TBC', "Dec '26", "Q4 '26", "Q1' 27"];
    expect([...labels].sort((a, b) => handoverKey(a) - handoverKey(b))).toEqual(["Q4 '26", "Dec '26", "Q1' 27", "Q2 '27", 'TBC']);
  });
});
