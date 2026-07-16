import { describe, expect, it } from 'vitest';
import { progressBar } from '../src/progress';

const FULL = '█';
const EMPTY = '░';

describe('progressBar', () => {
  it('renders an all-empty bar at 0%', () => {
    expect(progressBar(0, 10)).toBe(EMPTY.repeat(10));
  });

  it('renders a full bar at 100%', () => {
    expect(progressBar(100, 10)).toBe(FULL.repeat(10));
  });

  it('fills proportionally at 60% width 10', () => {
    expect(progressBar(60, 10)).toBe(FULL.repeat(6) + EMPTY.repeat(4));
  });

  it('supports a width of 20', () => {
    expect(progressBar(70, 20)).toBe(FULL.repeat(14) + EMPTY.repeat(6));
  });

  it('renders all-empty for a null percentage', () => {
    expect(progressBar(null, 12)).toBe(EMPTY.repeat(12));
  });

  it('renders all-empty for a non-finite percentage', () => {
    expect(progressBar(Number.NaN, 8)).toBe(EMPTY.repeat(8));
  });

  it('clamps percentages above 100', () => {
    expect(progressBar(150, 10)).toBe(FULL.repeat(10));
  });

  it('clamps negative percentages to 0', () => {
    expect(progressBar(-25, 10)).toBe(EMPTY.repeat(10));
  });

  it('honors custom fill and empty characters', () => {
    expect(progressBar(50, 4, { filled: '#', empty: '-' })).toBe('##--');
  });

  it('always yields exactly `width` cells with partial blocks', () => {
    for (let pct = 0; pct <= 100; pct += 7) {
      const bar = progressBar(pct, 10, { partial: true });
      expect([...bar]).toHaveLength(10);
    }
  });

  it('uses an eighth-block glyph for the trailing partial cell', () => {
    // 55% of 10 cells = 44 eighths = 5 full + 4/8 -> "▌".
    expect(progressBar(55, 10, { partial: true })).toBe(`${FULL.repeat(5)}▌${EMPTY.repeat(4)}`);
  });

  it('treats width < 1 as a single cell', () => {
    expect(progressBar(100, 0)).toBe(FULL);
  });
});
