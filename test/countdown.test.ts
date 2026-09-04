import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDuration, formatResetsIn } from '../src/countdown';

// Fixed reference clock (arbitrary but stable).
const NOW = 1_700_000_000_000;
const at = (secondsFromNow: number): number => Math.floor(NOW / 1000) + secondsFromNow;

describe('formatCountdown', () => {
  it('returns -- for null/undefined', () => {
    expect(formatCountdown(null, NOW)).toBe('--');
    expect(formatCountdown(undefined, NOW)).toBe('--');
  });

  it('returns -- for a non-finite value', () => {
    expect(formatCountdown(Number.NaN, NOW)).toBe('--');
  });

  it('returns "now" when the reset is in the past', () => {
    expect(formatCountdown(at(-60), NOW)).toBe('now');
  });

  it('formats hours and minutes', () => {
    expect(formatCountdown(at(2 * 3600 + 14 * 60), NOW)).toBe('2h 14m');
  });

  it('formats days and hours', () => {
    expect(formatCountdown(at(5 * 86400 + 3 * 3600), NOW)).toBe('5d 3h');
  });

  it('formats minutes only when under an hour', () => {
    expect(formatCountdown(at(13 * 60), NOW)).toBe('13m');
  });
});

describe('formatResetsIn', () => {
  it('returns an empty string when unavailable', () => {
    expect(formatResetsIn(null, NOW)).toBe('');
  });

  it('phrases a future reset', () => {
    expect(formatResetsIn(at(2 * 3600 + 14 * 60), NOW)).toBe('Resets in 2h 14m');
  });

  it('phrases an elapsed reset', () => {
    expect(formatResetsIn(at(-10), NOW)).toBe('Resets now');
  });
});

describe('formatDuration', () => {
  it('returns -- for invalid input', () => {
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(-1)).toBe('--');
  });

  it('formats seconds', () => {
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(133_000)).toBe('2m 13s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3_661_000)).toBe('1h 1m');
  });
});
