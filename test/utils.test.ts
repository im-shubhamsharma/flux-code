import { describe, expect, it } from 'vitest';
import { formatBurnRate, formatCost, formatLines } from '../src/utils';

describe('formatCost', () => {
  it('formats a USD amount', () => {
    expect(formatCost(0.1234)).toBe('$0.12');
    expect(formatCost(null)).toBe('--');
  });
});

describe('formatLines', () => {
  it('formats added and removed counts', () => {
    expect(formatLines(124, 18)).toBe('+124 −18');
  });

  it('treats a missing side as zero', () => {
    expect(formatLines(50, null)).toBe('+50 −0');
    expect(formatLines(null, 7)).toBe('+0 −7');
  });

  it('returns null when both sides are absent', () => {
    expect(formatLines(null, null)).toBeNull();
  });
});

describe('formatBurnRate', () => {
  it('computes dollars per hour', () => {
    // $0.60 over 30 minutes => $1.20/h
    expect(formatBurnRate(0.6, 30 * 60 * 1000)).toBe('$1.20/h');
  });

  it('returns null when inputs are missing', () => {
    expect(formatBurnRate(null, 60 * 60 * 1000)).toBeNull();
    expect(formatBurnRate(1, null)).toBeNull();
  });

  it('returns null for durations too short to extrapolate', () => {
    expect(formatBurnRate(1, 10_000)).toBeNull();
  });
});
